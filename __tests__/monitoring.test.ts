/**
 * @format
 */

import { AsyncStorageEventRepository } from '../src/api/infrastructure/AsyncStorageEventRepository';
import { ChessResultsProvider } from '../src/api/infrastructure/ChessResultsProvider';
import { MonitoringService } from '../src/api/application/services/MonitoringService';
import { Notification } from '../src/api/domain/Notification';
import { Notifier } from '../src/api/application/notifiers/Notifier';
import { TournamentService } from '../src/api/application/services/TournamentService';

jest.mock('@react-native-async-storage/async-storage', () => {
    const store = new Map<string, string>();

    return {
        __esModule: true,
        default: {
            getItem: jest.fn(async (key: string) => store.get(key) ?? null),
            setItem: jest.fn(async (key: string, value: string) => {
                store.set(key, value);
            }),
            clear: jest.fn(async () => store.clear()),
        },
    };
});

const SAMPLE_URL = 'https://s1.chess-results.com/tnr1234567.aspx';

class RecordingNotifier implements Notifier {
    public readonly sent: Notification[] = [];

    async notify(notification: Notification): Promise<void> {
        this.sent.push(notification);
    }
}

const build = () => {
    const provider = new ChessResultsProvider();
    const repository = new AsyncStorageEventRepository();
    const notifier = new RecordingNotifier();

    return {
        notifier,
        repository,
        tournamentService: new TournamentService(provider, repository),
        monitoringService: new MonitoringService(
            provider,
            repository,
            notifier,
        ),
    };
};

beforeEach(async () => {
    const AsyncStorage =
        require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.clear();
});

test('registering a tournament persists a replayable stream', async () => {
    const { tournamentService, repository } = build();

    const details = await tournamentService.registerTournament(SAMPLE_URL);

    expect(details.name).toBe('Mock Tournament Name');
    expect(await repository.listAggregateIds()).toEqual([SAMPLE_URL]);

    const events = await repository.load(SAMPLE_URL);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('TournamentRegistered');
});

test('a tick notifies once when the round moves on', async () => {
    const { tournamentService, monitoringService, notifier } = build();

    await tournamentService.registerTournament(SAMPLE_URL);

    // The mock provider advances the round on every poll, so this tick sees a
    // new round and the next one, given a fresh provider, does not.
    expect(await monitoringService.checkAll()).toBe(1);
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].body).toBe('Round 2 pairings are out');
    expect(notifier.sent[0].tag).toBe(SAMPLE_URL);
});

test('a tick with no new round produces no event and no notification', async () => {
    const { tournamentService, repository } = build();

    await tournamentService.registerTournament(SAMPLE_URL);

    // A second service sharing the store but with its own provider, which
    // restarts at round 1 — i.e. the round has not moved on.
    const stale = build();
    const before = (await repository.load(SAMPLE_URL)).length;

    expect(await stale.monitoringService.checkAll()).toBe(0);
    expect(stale.notifier.sent).toHaveLength(0);
    expect(await repository.load(SAMPLE_URL)).toHaveLength(before);
});

test('saving twice does not append the same events again', async () => {
    const { tournamentService, repository } = build();

    await tournamentService.registerTournament(SAMPLE_URL);

    const tournament = (await tournamentService.listTournaments())[0];
    await repository.save(tournament);

    expect(await repository.load(SAMPLE_URL)).toHaveLength(1);
});

test('an unreachable tournament does not abort the tick', async () => {
    const { tournamentService, repository, notifier } = build();

    await tournamentService.registerTournament(SAMPLE_URL);

    const failing = {
        getTournamentDetails: jest.fn(async () => {
            throw new Error('network down');
        }),
    };

    const service = new MonitoringService(failing, repository, notifier);

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(service.checkAll()).resolves.toBe(0);

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(failing.getTournamentDetails).toHaveBeenCalled();
});
