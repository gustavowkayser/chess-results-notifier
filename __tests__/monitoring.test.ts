/**
 * @format
 */

import { MonitoringService } from '../src/api/application/services/MonitoringService';
import { Notification } from '../src/api/domain/Notification';
import { Notifier } from '../src/api/application/notifiers/Notifier';
import { PublishedRound } from '../src/api/domain/PublishedRound';
import { TournamentRepository } from '../src/api/application/repositories/TournamentRepository';

const SAMPLE_URL = 'https://s1.chess-results.com/tnr1234567.aspx';
const OTHER_URL = 'https://s2.chess-results.com/tnr7654321.aspx';

class RecordingNotifier implements Notifier {
    public readonly sent: Notification[] = [];

    async notify(notification: Notification): Promise<void> {
        this.sent.push(notification);
    }
}

/**
 * The backend, as far as a tick is concerned: a queue of rounds that empties
 * when it is claimed. Everything else on TournamentRepository belongs to the
 * screens, not to monitoring.
 */
class StubRepository implements TournamentRepository {
    public claims = 0;

    constructor(private pending: PublishedRound[] = []) {}

    async claimPendingRounds(): Promise<PublishedRound[]> {
        this.claims++;

        const claimed = this.pending;
        this.pending = [];

        return claimed;
    }

    async list(): Promise<never[]> {
        throw new Error('not used by monitoring');
    }

    async register(): Promise<void> {
        throw new Error('not used by monitoring');
    }

    async unregister(): Promise<void> {
        throw new Error('not used by monitoring');
    }
}

const round = (tournamentUrl: string, currentRound: number): PublishedRound => ({
    tournamentUrl,
    name: 'Campeonato Goiano Blitz',
    currentRound,
    totalRounds: 9,
});

test('a tick shows one notification per claimed round', async () => {
    const notifier = new RecordingNotifier();
    const repository = new StubRepository([round(SAMPLE_URL, 2)]);

    await expect(
        new MonitoringService(repository, notifier).deliverPending(),
    ).resolves.toBe(1);

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].title).toBe('Campeonato Goiano Blitz');
    expect(notifier.sent[0].body).toBe('Round 2 of 9 pairings are out');
    // The URL as tag, so a later round replaces the previous notification for
    // the same tournament rather than stacking up.
    expect(notifier.sent[0].tag).toBe(SAMPLE_URL);
});

// Claiming is what marks the rounds seen, so the second tick finds nothing.
// This is the property that stops the same round being announced twice.
test('a round is announced once, however often the tick runs', async () => {
    const notifier = new RecordingNotifier();
    const repository = new StubRepository([round(SAMPLE_URL, 2)]);
    const monitoring = new MonitoringService(repository, notifier);

    await monitoring.deliverPending();

    await expect(monitoring.deliverPending()).resolves.toBe(0);
    expect(notifier.sent).toHaveLength(1);
    expect(repository.claims).toBe(2);
});

test('a quiet tick asks once and shows nothing', async () => {
    const notifier = new RecordingNotifier();
    const repository = new StubRepository();

    await expect(
        new MonitoringService(repository, notifier).deliverPending(),
    ).resolves.toBe(0);

    expect(notifier.sent).toHaveLength(0);
    expect(repository.claims).toBe(1);
});

test('one notification that cannot be shown does not sink the rest', async () => {
    const shown: string[] = [];

    const notifier: Notifier = {
        notify: async notification => {
            if (notification.tag === SAMPLE_URL) {
                throw new Error('notifications are blocked');
            }

            shown.push(notification.tag);
        },
    };

    const repository = new StubRepository([
        round(SAMPLE_URL, 2),
        round(OTHER_URL, 5),
    ]);

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
        new MonitoringService(repository, notifier).deliverPending(),
    ).resolves.toBe(1);

    expect(shown).toEqual([OTHER_URL]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
});

test('a backend that cannot be reached fails the tick loudly', async () => {
    const repository = new StubRepository();

    repository.claimPendingRounds = async () => {
        throw new Error('Could not check for new rounds: offline');
    };

    await expect(
        new MonitoringService(repository, new RecordingNotifier()).deliverPending(),
    ).rejects.toThrow(/offline/);
});
