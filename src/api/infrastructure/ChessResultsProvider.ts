import { TournamentProvider } from '../application/providers/TournamentProvider.ts';
import { TournamentDetailsDTO } from '../application/dtos/TournamentDetailsDTO.ts';

export class ChessResultsProvider implements TournamentProvider {
    constructor() {}

    public async getTournamentDetails(_tournamentUrl: string) {
        return {
            name: 'Mock Tournament Name',
        } as TournamentDetailsDTO;
    }
}
