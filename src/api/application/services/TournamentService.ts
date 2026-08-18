import { TournamentDetails } from '../../domain/TournamentDetails.ts';
import { TournamentProvider } from '../providers/TournamentProvider.ts';
import { EventRepository } from '../repositories/EventRepository.ts';
import { Tournament } from '../../domain/Tournament.ts';

export class TournamentService {
    constructor(
        private readonly tournamentProvider: TournamentProvider,
        private readonly eventRepository: EventRepository,
    ) {}

    async registerTournament(
        tournamentUrl: string,
    ): Promise<TournamentDetails> {
        // The aggregate id is derived from the URL, so the same tournament
        // reached with different query parameters has to collapse to one
        // stream rather than registering twice.
        const canonicalUrl = this.tournamentProvider.canonicalUrl(tournamentUrl);

        const tournamentDetails =
            await this.tournamentProvider.getTournamentDetails(canonicalUrl);

        const tournament = Tournament.register(
            canonicalUrl,
            tournamentDetails.toDomain(),
        );

        await this.eventRepository.save(tournament);

        return tournament.getDetails();
    }

    /**
     * Stops tracking a tournament. The stream is kept — the aggregate records
     * that it was unregistered — so this is an append, not a delete.
     */
    async unregisterTournament(tournamentUrl: string): Promise<void> {
        const canonicalUrl = this.tournamentProvider.canonicalUrl(tournamentUrl);
        const events = await this.eventRepository.load(canonicalUrl);

        if (!events.length) {
            return;
        }

        const tournament = Tournament.rehydrate(canonicalUrl, events);
        tournament.unregister();

        await this.eventRepository.save(tournament);
    }

    /** Only the tournaments still being tracked. */
    async listTournaments(): Promise<Tournament[]> {
        const ids = await this.eventRepository.listAggregateIds();

        const tournaments = await Promise.all(
            ids.map(async id =>
                Tournament.rehydrate(id, await this.eventRepository.load(id)),
            ),
        );

        return tournaments.filter(tournament => !tournament.isUnregistered());
    }
}
