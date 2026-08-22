import { TournamentProvider } from '../application/providers/TournamentProvider.ts';
import { TournamentDetailsDTO } from '../application/dtos/TournamentDetailsDTO.ts';
import { ChessResultsUrl } from './ChessResultsUrl.ts';
import { TournamentPageParser } from './TournamentPageParser.ts';

/** English. Parsing does not depend on it, so this is only a display choice. */
export const DEFAULT_LANGUAGE = 1;

// chess-results was only ever exercised with a browser User-Agent during
// development; React Native's default is untested against this host.
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export type FetchPage = (url: string) => Promise<string>;

const fetchPageOverHttp: FetchPage = async url => {
    const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
        throw new Error(`chess-results responded ${response.status} for ${url}`);
    }

    return await response.text();
};

export class ChessResultsProvider implements TournamentProvider {
    public constructor(
        private readonly language: number = DEFAULT_LANGUAGE,
        private readonly fetchPage: FetchPage = fetchPageOverHttp,
    ) {}

    public canonicalUrl(tournamentUrl: string): string {
        return ChessResultsUrl.parse(tournamentUrl).canonical();
    }

    public async getTournamentDetails(
        tournamentUrl: string,
    ): Promise<TournamentDetailsDTO> {
        const url = ChessResultsUrl.parse(tournamentUrl);
        const html = await this.fetchPage(url.pageUrl(this.language));

        return TournamentPageParser.parse(html);
    }
}
