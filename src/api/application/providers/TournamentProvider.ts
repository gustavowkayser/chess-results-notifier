import { TournamentDetailsDTO } from '../dtos/TournamentDetailsDTO.ts';

export interface TournamentProvider {
    getTournamentDetails(tournamentUrl: string): Promise<TournamentDetailsDTO>;
}
