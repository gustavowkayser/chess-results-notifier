import { DomainEvent } from '../DomainEvent.ts';

/**
 * The first time anyone asked us to follow this tournament. It opens the shared
 * stream and records what chess-results said at that moment; every later change
 * arrives as a RoundPublished.
 *
 * Distinct from TournamentRegistered, which is one user's intent. A second user
 * following the same tournament registers but discovers nothing — and that is
 * exactly the saving this whole design exists for.
 */
export class TournamentDiscovered extends DomainEvent {
    public static readonly TYPE = 'TournamentDiscovered';

    public constructor(
        aggregateId: string,
        public readonly name: string,
        public readonly currentRound: number,
        public readonly totalRounds: number,
        occurredAt?: Date,
    ) {
        super(aggregateId, TournamentDiscovered.TYPE, occurredAt);
    }

    public payload() {
        return {
            name: this.name,
            currentRound: this.currentRound,
            totalRounds: this.totalRounds,
        };
    }
}
