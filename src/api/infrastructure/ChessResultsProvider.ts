import { TournamentProvider } from '../application/providers/TournamentProvider.ts';
import { TournamentDetailsDTO } from '../application/dtos/TournamentDetailsDTO.ts';

export class ChessResultsProvider implements TournamentProvider {
    // TODO: replace with real scraping of sx.chess-results.com. Until then the
    // round advances on every poll so the monitoring pipeline is exercisable.
    private readonly mockRounds = new Map<string, number>();

    constructor() {}

    public async getTournamentDetails(tournamentUrl: string) {
        const round = (this.mockRounds.get(tournamentUrl) ?? 0) + 1;
        this.mockRounds.set(tournamentUrl, round);

        return new TournamentDetailsDTO('Mock Tournament Name', round);
    }
}
