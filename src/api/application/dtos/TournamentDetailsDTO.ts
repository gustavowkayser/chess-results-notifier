import { TournamentDetails } from '../../domain/TournamentDetails.ts';

export class TournamentDetailsDTO {
    public constructor(
        public readonly name: string,
        public readonly currentRound: number,
    ) {}

    public toDomain(): TournamentDetails {
        return new TournamentDetails(this.name, this.currentRound);
    }
}
