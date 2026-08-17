import { TournamentDetails } from '../../domain/TournamentDetails.ts';
import { TournamentProvider } from '../providers/TournamentProvider.ts';
import { TournamentDetailsMapper } from '../../infrastructure/mappers/TournamentDetailsMapper.ts';

export class TournamentService {
    constructor(private readonly tournamentProvider: TournamentProvider) {}

    async getTournamentDetails(
        tournamentUrl: string,
    ): Promise<TournamentDetails> {
        const details = await this.tournamentProvider.getTournamentDetails(
            tournamentUrl,
        );

        return TournamentDetailsMapper.toDomain(details);
    }
}
