import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { SearchScreen } from '../src/ui/screens/SearchScreen.tsx';

const mockRegisterTournament = jest.fn();

jest.mock('../src/api', () => ({
    tournamentService: {
        registerTournament: (url: string) => mockRegisterTournament(url),
    },
    // The real predicate is exercised in tournamentUrl.test.ts; here it has to
    // behave, not be stubbed, or the screen's branching is untested.
    isTournamentUrl: (text: string) =>
        /^https?:\/\/(?:[a-z0-9-]+\.)*chess-results\.com\/tnr\d+\.aspx/i.test(
            text.trim(),
        ),
}));

jest.mock('react-native-safe-area-context', () =>
    require('react-native-safe-area-context/jest/mock').default,
);

const URL = 'https://s1.chess-results.com/tnr1477210.aspx';

const render = async () => {
    const goBack = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(
            <SearchScreen navigation={{ goBack }} />,
        );
    });

    const act = async (work: () => unknown) =>
        await ReactTestRenderer.act(async () => {
            work();
        });

    return {
        goBack,
        type: (text: string) =>
            act(() =>
                tree.root
                    .findByType(TextInput as never)
                    .props.onChangeText(text),
            ),
        back: () =>
            act(() =>
                tree.root
                    .findByProps({ testID: 'search-back' })
                    .props.onPress(),
            ),
        submit: () =>
            act(() =>
                tree.root
                    .findByProps({ testID: 'register-tournament' })
                    .props.onPress(),
            ),
        hasResult: () =>
            tree.root.findAllByProps({ testID: 'register-tournament' }).length >
            0,
        text: () =>
            tree.root
                .findAll(node => typeof node.props.children === 'string')
                .map(node => String(node.props.children))
                .join('\n'),
    };
};

beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterTournament.mockResolvedValue(undefined);
});

describe('search screen', () => {
    test('explains what to paste before anything is typed', async () => {
        const { text, hasResult } = await render();

        expect(text()).toContain('chess-results');
        expect(hasResult()).toBe(false);
    });

    test('offers a tournament result for a pasted URL', async () => {
        const { type, hasResult } = await render();

        await type(URL);

        expect(hasResult()).toBe(true);
    });

    test('registers the trimmed URL and returns home', async () => {
        const { type, submit, goBack } = await render();

        await type(`  ${URL}  `);
        await submit();

        expect(mockRegisterTournament).toHaveBeenCalledWith(URL);
        expect(goBack).toHaveBeenCalled();
    });

    test('shows a rejected URL and stays put', async () => {
        mockRegisterTournament.mockRejectedValue(
            new Error('Tournament page could not be read'),
        );

        const { type, submit, goBack, text } = await render();

        await type(URL);
        await submit();

        expect(text()).toContain('Tournament page could not be read');
        expect(goBack).not.toHaveBeenCalled();
    });

    // Typing a player's name is not a mistake, it is the unbuilt half of this
    // screen, so it must not read as an error.
    test('treats non-URL text as a pending feature, not a failure', async () => {
        const { type, text, hasResult } = await render();

        await type('Magnus Carlsen');

        expect(text()).toContain('coming soon');
        expect(hasResult()).toBe(false);
        expect(mockRegisterTournament).not.toHaveBeenCalled();
    });

    test('goes back when the back control is used', async () => {
        const { back, goBack } = await render();

        await back();

        expect(goBack).toHaveBeenCalled();
    });
});
