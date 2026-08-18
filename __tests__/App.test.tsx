/**
 * @format
 */

import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

const mockRegisterTournament = jest.fn();

jest.mock('../src/api', () => ({
    tournamentService: {
        registerTournament: (url: string) => mockRegisterTournament(url),
    },
    monitoringService: {},
}));

// SafeAreaProvider withholds its children until it has measured insets, which
// never happens under the test renderer — without this the app body does not
// render at all. The library ships this mock for the purpose.
jest.mock('react-native-safe-area-context', () =>
    // The mock hangs everything off `default`.
    require('react-native-safe-area-context/jest/mock').default,
);

const render = async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
        tree = ReactTestRenderer.create(<App />);
    });

    const input = tree.root.findByType(TextInput as never);
    // The register button's label changes while a request is in flight, so it
    // is matched by prefix.
    const button = (label: string) =>
        tree.root.find(
            node =>
                typeof node.props.label === 'string' &&
                node.props.label.startsWith(label),
        );

    const type = async (text: string) =>
        await ReactTestRenderer.act(async () => input.props.onChangeText(text));

    const press = async (label: string) =>
        await ReactTestRenderer.act(async () => button(label).props.onPress());

    const log = () =>
        tree.root
            .findAll(node => typeof node.props.children === 'string')
            .map(node => String(node.props.children));

    return { input, type, press, log };
};

beforeEach(() => mockRegisterTournament.mockReset());

test('renders correctly', async () => {
    await render();
});

test('registers the URL that was typed', async () => {
    mockRegisterTournament.mockResolvedValue({
        name: 'JOGGA School Chess Championship 2026',
        currentRound: 5,
        totalRounds: 7,
    });

    const { type, press, log } = await render();

    // Padded, as it would be pasted from a browser address bar.
    await type('  https://s1.chess-results.com/tnr1475106.aspx  ');
    await press('Register');

    expect(mockRegisterTournament).toHaveBeenCalledWith(
        'https://s1.chess-results.com/tnr1475106.aspx',
    );
    expect(log().join('\n')).toContain('at round 5 of 7');
});

test('reports a rejected URL instead of crashing', async () => {
    mockRegisterTournament.mockRejectedValue(
        new Error('Not a chess-results tournament URL: "nonsense"'),
    );

    const { type, press, log } = await render();

    await type('nonsense');
    await press('Register');

    expect(log().join('\n')).toContain('could not register');
});

test('does not register a blank URL', async () => {
    const { press } = await render();

    await press('Register');

    expect(mockRegisterTournament).not.toHaveBeenCalled();
});
