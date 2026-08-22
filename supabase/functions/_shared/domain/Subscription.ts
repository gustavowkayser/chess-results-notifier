import { AggregateRoot } from './AggregateRoot.ts';
import { DomainEvent } from './DomainEvent.ts';
import { TournamentRegistered } from './events/TournamentRegistered.ts';
import { TournamentUnregistered } from './events/TournamentUnregistered.ts';

/**
 * One user's interest in one tournament. The other half of what used to be a
 * single Tournament aggregate: this side is per-user and private, the shared
 * side is public and written only by the refresh job.
 */
export class Subscription extends AggregateRoot {
    public static readonly TYPE = 'subscription';

    private active = false;

    private constructor(
        private readonly ownerId: string,
        private readonly tournamentUrl: string,
    ) {
        super(
            Subscription.idFor(ownerId, tournamentUrl),
            Subscription.TYPE,
            ownerId,
        );
    }

    public static idFor(userId: string, tournamentUrl: string) {
        return `${userId}:${tournamentUrl}`;
    }

    public static rehydrate(
        userId: string,
        tournamentUrl: string,
        events: readonly DomainEvent[],
    ) {
        const subscription = new Subscription(userId, tournamentUrl);
        subscription.replay(events);

        return subscription;
    }

    public isActive() {
        return this.active;
    }

    /**
     * Starts, or resumes, following. Registering something already followed
     * produces no event, so re-adding a tournament from the search screen does
     * not pad the stream.
     */
    public register(): void {
        if (this.active) {
            return;
        }

        this.apply(new TournamentRegistered(this.id, this.tournamentUrl));
    }

    /** Symmetrically, unregistering something already gone is a no-op. */
    public unregister(): void {
        if (!this.active) {
            return;
        }

        this.apply(new TournamentUnregistered(this.id, this.tournamentUrl));
    }

    protected mutate(event: DomainEvent): void {
        if (event instanceof TournamentRegistered) {
            this.active = true;

            return;
        }

        if (event instanceof TournamentUnregistered) {
            this.active = false;
        }
    }
}
