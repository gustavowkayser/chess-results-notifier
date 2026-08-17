import { AggregateRoot } from './AggregateRoot.ts';
import { TournamentRegistered } from './events/TournamentRegistered.ts';
import { TournamentDetails } from './TournamentDetails.ts';

export class Tournament extends AggregateRoot {
    private constructor(public readonly tournamentDetails: TournamentDetails) {
        super();
    }

    public static register(tournamentDetails: TournamentDetails) {
        const tournament = new Tournament(tournamentDetails);
        tournament.apply(new TournamentRegistered());
    }
}
