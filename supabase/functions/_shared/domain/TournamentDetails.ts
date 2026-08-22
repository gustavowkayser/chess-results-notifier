export class TournamentDetails {
    public constructor(
        public readonly name: string,
        public readonly currentRound: number,
        public readonly totalRounds: number,
    ) {}
}
