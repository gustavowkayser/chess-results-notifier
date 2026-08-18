import { RoundPublished } from '../src/api/domain/events/RoundPublished.ts';
import { Tournament } from '../src/api/domain/Tournament.ts';
import { TournamentDetails } from '../src/api/domain/TournamentDetails.ts';
import { TournamentRegistered } from '../src/api/domain/events/TournamentRegistered.ts';

const ID = 'https://s1.chess-results.com/tnr1.aspx';

describe('AggregateRoot.getUpdatedAt', () => {
    test('reports the timestamp of the newest replayed event', () => {
        const tournament = Tournament.rehydrate(ID, [
            new TournamentRegistered(
                ID,
                ID,
                'Goiano Blitz',
                1,
                7,
                new Date('2026-08-01T10:00:00Z'),
            ),
            new RoundPublished(ID, 2, 7, new Date('2026-08-03T18:30:00Z')),
        ]);

        expect(tournament.getUpdatedAt()).toEqual(
            new Date('2026-08-03T18:30:00Z'),
        );
    });

    test('reports nothing for an aggregate with no events', () => {
        expect(Tournament.rehydrate(ID, []).getUpdatedAt()).toBeNull();
    });

    // apply() and replay() have to agree, or a card would change its timestamp
    // the moment the app restarted.
    test('tracks events applied now, not only replayed ones', () => {
        const before = Date.now();

        const tournament = Tournament.register(
            ID,
            new TournamentDetails('Goiano Blitz', 0, 7),
        );

        const updatedAt = tournament.getUpdatedAt();

        expect(updatedAt).not.toBeNull();
        expect(updatedAt!.getTime()).toBeGreaterThanOrEqual(before);
    });

    test('advances when a later event is applied', () => {
        const tournament = Tournament.rehydrate(ID, [
            new TournamentRegistered(
                ID,
                ID,
                'Goiano Blitz',
                1,
                7,
                new Date('2026-08-01T10:00:00Z'),
            ),
        ]);

        tournament.observe(new TournamentDetails('Goiano Blitz', 2, 7));

        expect(tournament.getUpdatedAt()!.getTime()).toBeGreaterThan(
            new Date('2026-08-01T10:00:00Z').getTime(),
        );
    });
});
