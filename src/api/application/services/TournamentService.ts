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

    async listTournaments(): Promise<Tournament[]> {
        const ids = await this.eventRepository.listAggregateIds();

        return await Promise.all(
            ids.map(async id =>
                Tournament.rehydrate(id, await this.eventRepository.load(id)),
            ),
        );
    }
}
