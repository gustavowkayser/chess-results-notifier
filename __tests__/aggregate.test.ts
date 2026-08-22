import { RoundPublished } from '../supabase/functions/_shared/domain/events/RoundPublished.ts';
import { Tournament } from '../supabase/functions/_shared/domain/Tournament.ts';
import { TournamentDetails } from '../supabase/functions/_shared/domain/TournamentDetails.ts';
import { TournamentDiscovered } from '../supabase/functions/_shared/domain/events/TournamentDiscovered.ts';

const ID = 'https://s1.chess-results.com/tnr1.aspx';

describe('AggregateRoot.getUpdatedAt', () => {
    test('reports the timestamp of the newest replayed event', () => {
        const tournament = Tournament.rehydrate(ID, [
            new TournamentDiscovered(
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

        const tournament = Tournament.discover(
            ID,
            new TournamentDetails('Goiano Blitz', 0, 7),
        );

        const updatedAt = tournament.getUpdatedAt();

        expect(updatedAt).not.toBeNull();
        expect(updatedAt!.getTime()).toBeGreaterThanOrEqual(before);
    });

    test('advances when a later event is applied', () => {
        const tournament = Tournament.rehydrate(ID, [
            new TournamentDiscovered(
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

describe('Tournament', () => {
    test('is unknown until somebody discovers it', () => {
        expect(Tournament.rehydrate(ID, []).isKnown()).toBe(false);
        expect(
            Tournament.discover(
                ID,
                new TournamentDetails('Goiano Blitz', 3, 9),
            ).isKnown(),
        ).toBe(true);
    });

    test('reports a round only when it has moved on', () => {
        const tournament = Tournament.discover(
            ID,
            new TournamentDetails('Goiano Blitz', 3, 9),
        );

        tournament.pullEvents();

        expect(
            tournament.observe(new TournamentDetails('Goiano Blitz', 3, 9)),
        ).toBe(false);
        expect(tournament.pullEvents()).toHaveLength(0);

        expect(
            tournament.observe(new TournamentDetails('Goiano Blitz', 4, 9)),
        ).toBe(true);
        expect(tournament.pullEvents()).toHaveLength(1);
    });

    // An organiser revising the schedule has to be reflected in replayed state,
    // rather than frozen at whatever was true on discovery.
    test('takes a revised round total from the round it publishes', () => {
        const tournament = Tournament.discover(
            ID,
            new TournamentDetails('Goiano Blitz', 3, 9),
        );

        tournament.observe(new TournamentDetails('Goiano Blitz', 4, 11));

        expect(tournament.getDetails().totalRounds).toBe(11);
    });
});
