import React from 'react';
import { DeviceEventEmitter, Linking } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { HomeScreen } from '../src/ui/screens/HomeScreen.tsx';
import { ToastProvider } from '../src/ui/Toast.tsx';

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

jest.mock(
    'react-native-safe-area-context',
    () => require('react-native-safe-area-context/jest/mock').default,
);

/** A tournament as listTournaments returns it: a row, not an aggregate. */
const tracked = (
    url: string,
    name: string,
    currentRound: number,
    totalRounds: number,
    updatedAt: Date | null = new Date(),
) => ({ url, name, currentRound, totalRounds, updatedAt });

beforeEach(() => {
    jest.useFakeTimers();
    // clearAllMocks forgets the calls but keeps the implementations, so every
    // mock a test rewires needs its default restored here or the next test
    // inherits it.
    jest.clearAllMocks();
    mockListTournaments.mockResolvedValue([]);
    mockUnregisterTournament.mockResolvedValue(undefined);
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
            // The real app mounts the provider above the navigator, and the
            // screen announces through it, so the toast is part of what these
            // tests are rendering.
            <ToastProvider>
                <HomeScreen navigation={{ navigate, addListener } as never} />
            </ToastProvider>,
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
                tree.root
                    .findByProps({ testID: 'open-search' })
                    .props.onPress(),
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
        open: (id: string) =>
            act(() =>
                tree.root.findByProps({ testID: `open-${id}` }).props.onPress(),
            ),
        openButton: (id: string) =>
            act(() =>
                tree.root
                    .findByProps({ testID: `open-button-${id}` })
                    .props.onPress(),
            ),
        ring: () =>
            tree.root.findByProps({ accessibilityRole: 'progressbar' }).props
                .accessibilityLabel,
        remove: (id: string) =>
            act(() =>
                tree.root
                    .findByProps({ testID: `unregister-${id}` })
                    .props.onPress(),
            ),
        toast: () => {
            const found = tree.root.findAllByProps({ testID: 'toast' });

            return found.length > 0
                ? String(found[0].props.accessibilityLabel)
                : null;
        },
        text: () =>
            tree.root
                .findAll(node => typeof node.props.children === 'string')
                .map(node => String(node.props.children))
                .join('\n'),
    };
};

/** A promise the test decides when to settle, standing in for a slow delete. */
const deferred = () => {
    let settle!: (error?: Error) => void;

    const promise = new Promise<void>((resolve, reject) => {
        settle = error => (error ? reject(error) : resolve());
    });

    // The rejection path is only taken when a test asks for it; without this
    // the pending promise counts as unhandled the moment it is created.
    promise.catch(() => {});

    return { promise, settle };
};

describe('tournament list', () => {
    test('shows an empty state when nothing is tracked', async () => {
        const { text } = await render();

        expect(text()).toContain('Nothing tracked yet');
    });

    test('renders a card per tournament with its round', async () => {
        mockListTournaments.mockResolvedValue([
            tracked(
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
            tracked(
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

    // A tournament that has never changed cannot claim a time, and a "·"
    // dangling off the round reads as a rendering bug.
    test('omits the timestamp when there is none', async () => {
        mockListTournaments.mockResolvedValue([
            tracked(
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
            tracked(
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

    // total_rounds defaults to 0 in the projection, and a page the parser could
    // not read a total from leaves it there. Seen on a real device as
    // "Round 5 of 0".
    test('omits the total when it is unknown rather than showing zero', async () => {
        mockListTournaments.mockResolvedValue([
            tracked('https://s1.chess-results.com/tnr1.aspx', 'Legacy', 5, 0),
        ]);

        const { text } = await render();

        expect(text()).toContain('Round 5');
        expect(text()).not.toContain('of 0');
    });

    // The card summarises a page the user will want to read in full: the
    // pairings, the standings, everything the round number stands in for.
    test('opens the chess-results page when the name is tapped', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        const openURL = jest
            .spyOn(Linking, 'openURL')
            .mockResolvedValue(true as never);
        mockListTournaments.mockResolvedValue([
            tracked(id, 'Goiano Blitz', 5, 7),
        ]);

        const { open } = await render();
        await open(id);

        expect(openURL).toHaveBeenCalledWith(id);

        openURL.mockRestore();
    });

    test('reports a link the device cannot open', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        const openURL = jest
            .spyOn(Linking, 'openURL')
            .mockRejectedValue(new Error('no activity found'));
        mockListTournaments.mockResolvedValue([
            tracked(id, 'Goiano Blitz', 5, 7),
        ]);

        const { open, text } = await render();
        await open(id);

        expect(text()).toContain('Could not open the chess-results page');

        openURL.mockRestore();
    });

    // The title and the lime button are one action with two affordances; a
    // regression in either leaves the card looking tappable where it is not.
    test('opens the page from the call-to-action button as well', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        const openURL = jest
            .spyOn(Linking, 'openURL')
            .mockResolvedValue(true as never);
        mockListTournaments.mockResolvedValue([
            tracked(id, 'Goiano Blitz', 5, 7),
        ]);

        const { openButton } = await render();
        await openButton(id);

        expect(openURL).toHaveBeenCalledWith(id);

        openURL.mockRestore();
    });

    // The ring is the only place the round appears as a shape rather than as
    // words, so it has to carry the same reading for a screen reader.
    test('labels the progress ring with the round it draws', async () => {
        mockListTournaments.mockResolvedValue([
            tracked(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
            ),
        ]);

        const { ring } = await render();

        expect(ring()).toBe('Round 5 of 7');
    });

    test('unregisters the tournament when the card is removed', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        mockListTournaments.mockResolvedValue([
            tracked(id, 'Goiano Blitz', 5, 7),
        ]);

        const { remove } = await render();

        mockListTournaments.mockResolvedValue([]);
        await remove(id);

        expect(mockUnregisterTournament).toHaveBeenCalledWith(id);
    });

    // The delete is a round trip to the server. Leaving the card up for its
    // duration read as a tap that had missed the button.
    test('takes the card off screen before the delete comes back', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        mockListTournaments.mockResolvedValue([
            tracked(id, 'Goiano Blitz', 5, 7),
        ]);

        const slow = deferred();
        mockUnregisterTournament.mockReturnValue(slow.promise);

        const { remove, text } = await render();
        await remove(id);

        expect(text()).not.toContain('Goiano Blitz');
        expect(text()).toContain('Nothing tracked yet');
    });

    // The card is gone locally but still on the server until the delete lands,
    // so a tick in that window would otherwise put it straight back.
    test('keeps a removed card off screen when a refresh lands first', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        mockListTournaments.mockResolvedValue([
            tracked(id, 'Goiano Blitz', 5, 7),
        ]);

        const slow = deferred();
        mockUnregisterTournament.mockReturnValue(slow.promise);

        const { remove, text } = await render();
        await remove(id);

        await ReactTestRenderer.act(async () => {
            DeviceEventEmitter.emit('onMonitoringTick');
        });

        expect(text()).not.toContain('Goiano Blitz');
    });

    test('confirms the removal once it has gone through', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        mockListTournaments.mockResolvedValue([
            tracked(id, 'Goiano Blitz', 5, 7),
        ]);

        const { remove, toast } = await render();
        await remove(id);

        expect(toast()).toBe('Tournament removed');
    });

    // Optimism has to be paid for: a delete that fails leaves the tournament
    // tracked, and a card that stays gone is a lie about what the app is doing.
    test('puts the card back and says so when the delete fails', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        mockListTournaments.mockResolvedValue([
            tracked(id, 'Goiano Blitz', 5, 7),
        ]);
        mockUnregisterTournament.mockRejectedValue(new Error('network down'));

        const { remove, text, toast } = await render();
        await remove(id);

        expect(text()).toContain('Goiano Blitz');
        expect(toast()).toBe('Could not remove tournament');
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
