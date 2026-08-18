import { TournamentDetailsDTO } from '../src/api/application/dtos/TournamentDetailsDTO.ts';
import { TournamentProvider } from '../src/api/application/providers/TournamentProvider.ts';

const TOTAL_ROUNDS = 9;

/**
 * The behaviour ChessResultsProvider had while it was a mock: the round
 * advances on every poll, per tournament. It moved here when the provider
 * started making real requests, so the monitoring tests keep exercising the
 * pipeline without touching the network.
 */
export class StubTournamentProvider implements TournamentProvider {
    private readonly rounds = new Map<string, number>();

    /** Every URL fetched, so tests can assert what was and was not polled. */
    public readonly fetched: string[] = [];

    public constructor(private readonly totalRounds: number = TOTAL_ROUNDS) {}

    public canonicalUrl(tournamentUrl: string): string {
        return tournamentUrl.split('?')[0];
    }

    public async getTournamentDetails(
        tournamentUrl: string,
    ): Promise<TournamentDetailsDTO> {
        this.fetched.push(tournamentUrl);

        const round = (this.rounds.get(tournamentUrl) ?? 0) + 1;
        this.rounds.set(tournamentUrl, round);

        return new TournamentDetailsDTO(
            'Mock Tournament Name',
            round,
            this.totalRounds,
        );
    }
}
