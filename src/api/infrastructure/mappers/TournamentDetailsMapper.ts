import { TournamentDetailsDTO } from '../../application/dtos/TournamentDetailsDTO.ts';
import { TournamentDetails } from '../../domain/TournamentDetails.ts';

export class TournamentDetailsMapper {
    public static toDomain(
        tournamentDetails: TournamentDetailsDTO,
    ): TournamentDetails {
        return new TournamentDetails(tournamentDetails.name);
    }
}
