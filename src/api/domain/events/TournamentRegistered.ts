import { DomainEvent } from '../DomainEvent.ts';

export class TournamentRegistered extends DomainEvent {
    public static readonly TYPE = 'TournamentRegistered';

    public constructor(
        aggregateId: string,
        public readonly tournamentUrl: string,
        public readonly name: string,
        public readonly currentRound: number,
        occurredAt?: Date,
    ) {
        super(aggregateId, TournamentRegistered.TYPE, occurredAt);
    }

    public payload() {
        return {
            tournamentUrl: this.tournamentUrl,
            name: this.name,
            currentRound: this.currentRound,
        };
    }
}
