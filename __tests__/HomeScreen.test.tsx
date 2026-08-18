import React from 'react';
import { DeviceEventEmitter } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { HomeScreen } from '../src/ui/screens/HomeScreen.tsx';

const mockUnregisterTournament = jest.fn();
const mockListTournaments = jest.fn();

jest.mock('../src/api', () => ({
    tournamentService: {
        unregisterTournament: (url: string) => mockUnregisterTournament(url),
        listTournaments: () => mockListTournaments(),
    },
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

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockListTournaments.mockResolvedValue([]);
    mockIsMonitoring.mockResolvedValue(false);
    mockStart.mockResolvedValue(true);
});

afterEach(() => {
    DeviceEventEmitter.removeAllListeners();
    jest.useRealTimers();
});

const render = async () => {
    const navigate = jest.fn();
    const focusListeners: Array<() => void> = [];
    const addListener = jest.fn((_event: string, listener: () => void) => {
        focusListeners.push(listener);

        return () => {};
    });

    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(
            <HomeScreen navigation={{ navigate, addListener } as never} />,
        );
    });

    const act = async (work: () => unknown) =>
        await ReactTestRenderer.act(async () => {
            work();
        });

    return {
        navigate,
        openSearch: () =>
            act(() =>
                tree.root.findByProps({ testID: 'open-search' }).props.onPress(),
            ),
        focus: () => act(() => focusListeners.forEach(listener => listener())),
        toggle: (next: boolean) =>
            act(() =>
                tree.root
                    .findByProps({ accessibilityRole: 'switch' })
                    .props.onPress(next),
            ),
        switchIsOn: () =>
            tree.root.findByProps({ accessibilityRole: 'switch' }).props
                .accessibilityState.checked,
        remove: (id: string) =>
            act(() =>
                tree.root
                    .findByProps({ testID: `unregister-${id}` })
                    .props.onPress(),
            ),
        text: () =>
            tree.root
                .findAll(node => typeof node.props.children === 'string')
                .map(node => String(node.props.children))
                .join('\n'),
    };
};

describe('tournament list', () => {
    test('shows an empty state when nothing is tracked', async () => {
        const { text } = await render();

        expect(text()).toContain('No tournaments yet');
    });

    test('renders a card per tournament with its round', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('Goiano Blitz');
        expect(text()).toContain('Round 5 of 7');
    });

    test('shows how long ago the tournament last changed', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
                new Date(Date.now() - 2 * 60 * 60 * 1000),
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('2h ago');
    });

    // A stream with no events cannot claim a time, and a "·" dangling off the
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
        expect(text()).not.toContain('Round 5 of 7 ·');
    });

    test('reads round zero as no pairings rather than "0 of 7"', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Not started',
                0,
                7,
            ),
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
        mockListTournaments.mockResolvedValue([
            aggregate(id, 'Goiano Blitz', 5, 7),
        ]);

        const { remove } = await render();

        mockListTournaments.mockResolvedValue([]);
        await remove(id);

        expect(mockUnregisterTournament).toHaveBeenCalledWith(id);
        expect(mockListTournaments).toHaveBeenCalledTimes(2);
    });

    // Registration happens on the other screen, so returning to this one is
    // the only moment a newly added tournament can appear.
    test('refreshes when the screen regains focus', async () => {
        const { focus } = await render();

        await focus();

        expect(mockListTournaments).toHaveBeenCalledTimes(2);
    });

    test('refreshes when a monitoring tick fires', async () => {
        await render();

        await ReactTestRenderer.act(async () => {
            DeviceEventEmitter.emit('onMonitoringTick');
        });

        expect(mockListTournaments).toHaveBeenCalledTimes(2);
    });
});

describe('search bar', () => {
    test('opens the search screen when tapped', async () => {
        const { openSearch, navigate } = await render();

        await openSearch();

        expect(navigate).toHaveBeenCalledWith('Search');
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
