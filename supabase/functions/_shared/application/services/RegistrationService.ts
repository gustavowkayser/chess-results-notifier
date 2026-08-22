import { EventRepository } from '../repositories/EventRepository.ts';
import { Subscription } from '../../domain/Subscription.ts';
import { Tournament } from '../../domain/Tournament.ts';
import { TournamentDetails } from '../../domain/TournamentDetails.ts';
import { TournamentProvider } from '../providers/TournamentProvider.ts';

/**
 * Following and unfollowing a tournament, on behalf of one user.
 *
 * The scrape here is the only one the request path ever does, and only for a
 * tournament nobody has asked for before. Everyone who follows it afterwards
 * rides on the same shared stream, which the scheduled refresh keeps current.
 */
export class RegistrationService {
    constructor(
        private readonly tournamentProvider: TournamentProvider,
        private readonly eventRepository: EventRepository,
    ) {}

    async register(
        userId: string,
        tournamentUrl: string,
    ): Promise<TournamentDetails> {
        // The stream id is derived from the URL, so the same tournament reached
        // with different query parameters has to collapse to one stream rather
        // than being discovered twice.
        const canonicalUrl = this.tournamentProvider.canonicalUrl(tournamentUrl);

        const tournament = await this.discover(canonicalUrl);
        const subscription = await this.subscriptionOf(userId, canonicalUrl);

        subscription.register();

        await this.eventRepository.save(subscription);

        return tournament.getDetails();
    }

    /**
     * Stops tracking. The subscription stream is kept — it records that the
     * tournament was once followed — so this is an append, not a delete. The
     * shared tournament stream is left alone; other people may still be on it.
     */
    async unregister(userId: string, tournamentUrl: string): Promise<void> {
        const canonicalUrl = this.tournamentProvider.canonicalUrl(tournamentUrl);
        const subscription = await this.subscriptionOf(userId, canonicalUrl);

        subscription.unregister();

        await this.eventRepository.save(subscription);
    }

    /**
     * The shared tournament, scraped and opened if this is the first time
     * anyone has asked for it. An already-known tournament is returned from the
     * log without touching chess-results: the refresh job saw it within the
     * last minute anyway.
     */
    private async discover(canonicalUrl: string): Promise<Tournament> {
        const events = await this.eventRepository.load(
            Tournament.TYPE,
            Tournament.idFor(canonicalUrl),
        );

        const known = Tournament.rehydrate(canonicalUrl, events);

        if (known.isKnown()) {
            return known;
        }

        const details =
            await this.tournamentProvider.getTournamentDetails(canonicalUrl);

        const discovered = Tournament.discover(canonicalUrl, details.toDomain());

        await this.eventRepository.save(discovered);

        return discovered;
    }

    private async subscriptionOf(
        userId: string,
        canonicalUrl: string,
    ): Promise<Subscription> {
        const events = await this.eventRepository.load(
            Subscription.TYPE,
            Subscription.idFor(userId, canonicalUrl),
        );

        return Subscription.rehydrate(userId, canonicalUrl, events);
    }
}
