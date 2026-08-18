/**
 * @format
 */

import { StubTournamentProvider } from '../test-support/StubTournamentProvider';
import { MonitoringService } from '../src/api/application/services/MonitoringService';
import { NodeSqliteDatabase } from '../test-support/NodeSqliteDatabase';
import { Notification } from '../src/api/domain/Notification';
import { Notifier } from '../src/api/application/notifiers/Notifier';
import { SqliteEventRepository } from '../src/api/infrastructure/SqliteEventRepository';
import { TournamentService } from '../src/api/application/services/TournamentService';

const SAMPLE_URL = 'https://s1.chess-results.com/tnr1234567.aspx';
const OTHER_URL = 'https://s2.chess-results.com/tnr7654321.aspx';

class RecordingNotifier implements Notifier {
    public readonly sent: Notification[] = [];

    async notify(notification: Notification): Promise<void> {
        this.sent.push(notification);
    }
}

// Every in-memory database is a separate store, so the database is passed in
// explicitly: two services sharing one are sharing it on purpose.
const build = (database: NodeSqliteDatabase) => {
    const provider = new StubTournamentProvider();
    const repository = new SqliteEventRepository(database);
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

let database: NodeSqliteDatabase;

beforeEach(() => {
    database = new NodeSqliteDatabase();
});

afterEach(() => {
    database.close();
});

test('registering a tournament persists a replayable stream', async () => {
    const { tournamentService, repository } = build(database);

    const details = await tournamentService.registerTournament(SAMPLE_URL);

    expect(details.name).toBe('Mock Tournament Name');
    expect(await repository.listAggregateIds()).toEqual([SAMPLE_URL]);

    const events = await repository.load(SAMPLE_URL);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('TournamentRegistered');
});

test('a tick notifies once when the round moves on', async () => {
    const { tournamentService, monitoringService, notifier } = build(database);

    await tournamentService.registerTournament(SAMPLE_URL);

    // The stub provider advances the round on every poll, so this tick sees a
    // new round and the next one, given a fresh provider, does not.
    expect(await monitoringService.checkAll()).toBe(1);
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].body).toBe('Round 2 of 9 pairings are out');
    expect(notifier.sent[0].tag).toBe(SAMPLE_URL);
});

test('a tick with no new round produces no event and no notification', async () => {
    const { tournamentService, repository } = build(database);

    await tournamentService.registerTournament(SAMPLE_URL);

    // A second service sharing the store but with its own provider, which
    // restarts at round 1 — i.e. the round has not moved on.
    const stale = build(database);
    const before = (await repository.load(SAMPLE_URL)).length;

    expect(await stale.monitoringService.checkAll()).toBe(0);
    expect(stale.notifier.sent).toHaveLength(0);
    expect(await repository.load(SAMPLE_URL)).toHaveLength(before);
});

test('saving twice does not append the same events again', async () => {
    const { tournamentService, repository } = build(database);

    await tournamentService.registerTournament(SAMPLE_URL);

    const tournament = (await tournamentService.listTournaments())[0];
    await repository.save(tournament);

    expect(await repository.load(SAMPLE_URL)).toHaveLength(1);
});

test('streams replay in order and aggregates list in registration order', async () => {
    const { tournamentService, monitoringService, repository } =
        build(database);

    await tournamentService.registerTournament(SAMPLE_URL);
    await tournamentService.registerTournament(OTHER_URL);

    // Two ticks, so each stream holds a registration followed by more than one
    // round — enough for append order to be observable.
    await monitoringService.checkAll();
    await monitoringService.checkAll();

    expect(await repository.listAggregateIds()).toEqual([
        SAMPLE_URL,
        OTHER_URL,
    ]);

    // Both streams are asserted: checkAll saves concurrently, and a failed
    // write on the second aggregate would otherwise go unnoticed here.
    for (const url of [SAMPLE_URL, OTHER_URL]) {
        const events = await repository.load(url);

        expect(events.map(event => event.type)).toEqual([
            'TournamentRegistered',
            'RoundPublished',
            'RoundPublished',
        ]);
        expect(events.map(event => event.payload().round)).toEqual([
            undefined,
            2,
            3,
        ]);
        expect(events.every(event => event.aggregateId === url)).toBe(true);
    }
});

test('an unreachable tournament does not abort the tick', async () => {
    const { tournamentService, repository, notifier } = build(database);

    await tournamentService.registerTournament(SAMPLE_URL);

    const failing = {
        canonicalUrl: (url: string) => url,
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
