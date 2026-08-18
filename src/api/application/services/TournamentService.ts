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
        const tournamentDetails =
            await this.tournamentProvider.getTournamentDetails(tournamentUrl);

        const tournament = Tournament.register(
            tournamentUrl,
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
