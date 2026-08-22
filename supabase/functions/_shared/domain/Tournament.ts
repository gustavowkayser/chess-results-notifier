import { AggregateRoot } from './AggregateRoot.ts';
import { DomainEvent } from './DomainEvent.ts';
import { RoundPublished } from './events/RoundPublished.ts';
import { TournamentDiscovered } from './events/TournamentDiscovered.ts';
import { TournamentDetails } from './TournamentDetails.ts';

/**
 * What chess-results currently says about one tournament. Shared: there is a
 * single stream per tournament no matter how many people follow it, which is
 * what keeps the scraping cost proportional to tournaments rather than users.
 *
 * Who follows it lives on Subscription, not here.
 */
export class Tournament extends AggregateRoot {
    public static readonly TYPE = 'tournament';

    private name = '';
    private currentRound = 0;
    private totalRounds = 0;
    private known = false;

    private constructor(id: string) {
        super(id, Tournament.TYPE);
    }

    /**
     * The canonical chess-results URL identifies the tournament, so reaching it
     * through two different links lands on the same event stream.
     */
    public static idFor(tournamentUrl: string) {
        return tournamentUrl;
    }

    public static discover(
        tournamentUrl: string,
        tournamentDetails: TournamentDetails,
    ) {
        const tournament = new Tournament(Tournament.idFor(tournamentUrl));

        tournament.apply(
            new TournamentDiscovered(
                tournament.id,
                tournamentDetails.name,
                tournamentDetails.currentRound,
                tournamentDetails.totalRounds,
            ),
        );

        return tournament;
    }

    public static rehydrate(id: string, events: readonly DomainEvent[]) {
        const tournament = new Tournament(id);
        tournament.replay(events);

        return tournament;
    }

    /** Whether anyone has ever scraped this tournament. */
    public isKnown() {
        return this.known;
    }

    public getDetails(): TournamentDetails {
        return new TournamentDetails(
            this.name,
            this.currentRound,
            this.totalRounds,
        );
    }

    /**
     * Records what the provider currently reports. Returns whether the round
     * actually moved on, so a refresh that sees no change is a no-op and
     * produces no event.
     *
     * The notification wording is composed on the device, from the read model,
     * because a round published once has to reach every subscriber.
     */
    public observe(tournamentDetails: TournamentDetails): boolean {
        if (tournamentDetails.currentRound <= this.currentRound) {
            return false;
        }

        this.apply(
            new RoundPublished(
                this.id,
                tournamentDetails.currentRound,
                tournamentDetails.totalRounds,
            ),
        );

        return true;
    }

    protected mutate(event: DomainEvent): void {
        if (event instanceof TournamentDiscovered) {
            this.name = event.name;
            this.currentRound = event.currentRound;
            this.totalRounds = event.totalRounds;
            this.known = true;

            return;
        }

        if (event instanceof RoundPublished) {
            this.currentRound = event.round;
            this.totalRounds = event.totalRounds;
        }
    }
}
