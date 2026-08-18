/**
 * @format
 */

import React from 'react';
import { Switch, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

const mockRegisterTournament = jest.fn();
const mockUnregisterTournament = jest.fn();
const mockListTournaments = jest.fn();

jest.mock('../src/api', () => ({
    tournamentService: {
        registerTournament: (url: string) => mockRegisterTournament(url),
        unregisterTournament: (url: string) => mockUnregisterTournament(url),
        listTournaments: () => mockListTournaments(),
    },
    monitoringService: {},
}));

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockIsMonitoring = jest.fn();

jest.mock('../src/monitoring/MonitoringController', () => ({
    MonitoringController: {
        start: (seconds: number) => mockStart(seconds),
        stop: () => mockStop(),
        isMonitoring: () => mockIsMonitoring(),
    },
}));

// SafeAreaProvider withholds its children until it has measured insets, which
// never happens under the test renderer — without this the app body does not
// render at all. The library ships this mock for the purpose.
jest.mock('react-native-safe-area-context', () =>
    require('react-native-safe-area-context/jest/mock').default,
);

/** A tournament as listTournaments returns it: an aggregate, not a DTO. */
const aggregate = (
    id: string,
    name: string,
    currentRound: number,
    totalRounds: number,
    updatedAt: Date | null = new Date(),
) => ({
    id,
    getDetails: () => ({ name, currentRound, totalRounds }),
    getUpdatedAt: () => updatedAt,
});

const render = async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    // Async so the mount effects — isMonitoring and the first listTournaments —
    // settle before any assertion runs.
    await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(<App />);
    });

    const act = async (work: () => unknown) =>
        await ReactTestRenderer.act(async () => {
            work();
        });

    return {
        tree,
        type: (text: string) =>
            act(() => tree.root.findByType(TextInput as never).props.onChangeText(text)),
        add: () =>
            act(() => tree.root.findByProps({ testID: 'add-tournament' }).props.onPress()),
        toggle: (next: boolean) =>
            act(() => tree.root.findByType(Switch as never).props.onValueChange(next)),
        remove: (id: string) =>
            act(() =>
                tree.root.findByProps({ testID: `unregister-${id}` }).props.onPress(),
            ),
        switchIsOn: () => tree.root.findByType(Switch as never).props.value,
        text: () =>
            tree.root
                .findAll(node => typeof node.props.children === 'string')
                .map(node => String(node.props.children))
                .join('\n'),
    };
};

beforeEach(() => {
    jest.clearAllMocks();
    mockListTournaments.mockResolvedValue([]);
    mockIsMonitoring.mockResolvedValue(false);
    mockStart.mockResolvedValue(true);
});

describe('tournament list', () => {
    test('shows an empty state when nothing is tracked', async () => {
        const { text } = await render();

        expect(text()).toContain('No tournaments yet');
    });

    test('shows how long ago the tournament last changed', async () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
                twoHoursAgo,
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('2h ago');
    });

    // A stream with no events cannot claim a time, and "· " dangling off the
    // round reads as a rendering bug.
    test('omits the timestamp when the aggregate has none', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
                null,
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('Round 5 of 7');
        expect(text()).not.toContain('·');
    });

    test('renders a card per tournament with its round', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate('https://s1.chess-results.com/tnr1.aspx', 'Goiano Blitz', 5, 7),
        ]);

        const { text } = await render();

        expect(text()).toContain('Goiano Blitz');
        expect(text()).toContain('Round 5 of 7');
    });

    test('reads round zero as no pairings rather than "0 of 7"', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate('https://s1.chess-results.com/tnr1.aspx', 'Not started', 0, 7),
        ]);

        const { text } = await render();

        expect(text()).toContain('No pairings yet');
        expect(text()).not.toContain('Round 0');
    });

    // Events written before totalRounds existed replay as 0. Seen on a real
    // device as "Round 5 of 0".
    test('omits the total when it is unknown rather than showing zero', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate('https://s1.chess-results.com/tnr1.aspx', 'Legacy', 5, 0),
        ]);

        const { text } = await render();

        expect(text()).toContain('Round 5');
        expect(text()).not.toContain('of 0');
    });

    test('unregisters and refreshes', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        mockListTournaments.mockResolvedValue([aggregate(id, 'Goiano Blitz', 5, 7)]);

        const { remove } = await render();

        mockListTournaments.mockResolvedValue([]);
        await remove(id);

        expect(mockUnregisterTournament).toHaveBeenCalledWith(id);
        expect(mockListTournaments).toHaveBeenCalledTimes(2);
    });
});

describe('registering', () => {
    test('registers the trimmed URL and refreshes', async () => {
        mockRegisterTournament.mockResolvedValue(undefined);

        const { type, add } = await render();

        await type('  https://s1.chess-results.com/tnr1475106.aspx  ');
        await add();

        expect(mockRegisterTournament).toHaveBeenCalledWith(
            'https://s1.chess-results.com/tnr1475106.aspx',
        );
        expect(mockListTournaments).toHaveBeenCalledTimes(2);
    });

    test('shows a rejected URL instead of crashing', async () => {
        mockRegisterTournament.mockRejectedValue(
            new Error('Not a chess-results tournament URL: "nonsense"'),
        );

        const { type, add, text } = await render();

        await type('nonsense');
        await add();

        expect(text()).toContain('Not a chess-results tournament URL');
    });

    test('does not register a blank URL', async () => {
        const { add } = await render();

        await add();

        expect(mockRegisterTournament).not.toHaveBeenCalled();
    });
});

describe('notifications toggle', () => {
    test('starts monitoring when switched on', async () => {
        const { toggle, switchIsOn } = await render();

        await toggle(true);

        expect(mockStart).toHaveBeenCalled();
        expect(switchIsOn()).toBe(true);
    });

    test('stops monitoring when switched off', async () => {
        mockIsMonitoring.mockResolvedValue(true);

        const { toggle, switchIsOn } = await render();

        await toggle(false);

        expect(mockStop).toHaveBeenCalled();
        expect(switchIsOn()).toBe(false);
    });

    // Otherwise the toggle sits on while nothing is ever delivered.
    test('returns to off and explains when the permission is denied', async () => {
        mockStart.mockResolvedValue(false);

        const { toggle, switchIsOn, text } = await render();

        await toggle(true);

        expect(switchIsOn()).toBe(false);
        expect(text()).toContain('Notifications are blocked');
    });

    test('reflects monitoring already running at launch', async () => {
        mockIsMonitoring.mockResolvedValue(true);

        const { switchIsOn } = await render();

        expect(switchIsOn()).toBe(true);
    });
});
