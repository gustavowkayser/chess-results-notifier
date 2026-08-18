import { AggregateRoot } from './AggregateRoot.ts';
import { DomainEvent } from './DomainEvent.ts';
import { Notification } from './Notification.ts';
import { RoundPublished } from './events/RoundPublished.ts';
import { TournamentRegistered } from './events/TournamentRegistered.ts';
import { TournamentDetails } from './TournamentDetails.ts';

export class Tournament extends AggregateRoot {
    private name = '';
    private currentRound = 0;
    private tournamentUrl = '';

    private constructor(id: string) {
        super(id);
    }

    /**
     * The chess-results URL identifies the tournament, so registering the same
     * link twice lands on the same event stream.
     */
    public static idFor(tournamentUrl: string) {
        return tournamentUrl;
    }

    public static register(
        tournamentUrl: string,
        tournamentDetails: TournamentDetails,
    ) {
        const tournament = new Tournament(Tournament.idFor(tournamentUrl));

        tournament.apply(
            new TournamentRegistered(
                tournament.id,
                tournamentUrl,
                tournamentDetails.name,
                tournamentDetails.currentRound,
            ),
        );

        return tournament;
    }

    public static rehydrate(id: string, events: readonly DomainEvent[]) {
        const tournament = new Tournament(id);
        tournament.replay(events);

        return tournament;
    }

    public getDetails(): TournamentDetails {
        return new TournamentDetails(this.name, this.currentRound);
    }

    public getUrl() {
        return this.tournamentUrl;
    }

    /**
     * Records what the provider currently reports. Returns a notification only
     * when the round actually moved on, so a monitoring tick that sees no
     * change is a no-op and produces no event.
     */
    public observe(tournamentDetails: TournamentDetails): Notification | null {
        if (tournamentDetails.currentRound <= this.currentRound) {
            return null;
        }

        this.apply(new RoundPublished(this.id, tournamentDetails.currentRound));

        return new Notification(
            this.name,
            `Round ${tournamentDetails.currentRound} pairings are out`,
            this.id,
        );
    }

    protected mutate(event: DomainEvent): void {
        if (event instanceof TournamentRegistered) {
            this.tournamentUrl = event.tournamentUrl;
            this.name = event.name;
            this.currentRound = event.currentRound;

            return;
        }

        if (event instanceof RoundPublished) {
            this.currentRound = event.round;
        }
    }
}
