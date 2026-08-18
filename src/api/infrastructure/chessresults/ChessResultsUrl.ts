// Deliberately regex rather than the URL constructor: React Native's URL
// implementation is incomplete, and the shape we accept is narrow enough that
// matching it directly is both simpler and portable.
const TOURNAMENT_URL =
    /^(https?:\/\/(?:[a-z0-9-]+\.)*chess-results\.com)\/tnr(\d+)\.aspx/i;

/**
 * A chess-results tournament address. The site is mirrored across s1/s2/s3, and
 * the same tournament can be reached with any number of query parameters, so
 * this keeps the two parts that actually identify it.
 */
export class ChessResultsUrl {
    private constructor(
        public readonly origin: string,
        public readonly tournamentId: string,
    ) {}

    public static parse(url: string): ChessResultsUrl {
        const match = TOURNAMENT_URL.exec(url.trim());

        if (!match) {
            throw new Error(`Not a chess-results tournament URL: "${url}"`);
        }

        return new ChessResultsUrl(match[1], match[2]);
    }

    /**
     * The form used as the aggregate id. Registering the same tournament with
     * different query parameters has to land on one event stream, not several.
     */
    public canonical(): string {
        return `${this.origin}/tnr${this.tournamentId}.aspx`;
    }

    /**
     * `lan` only changes prose the parser does not read, and `SNode=S0` asks for
     * the overview that carries the round links.
     */
    public pageUrl(language: number): string {
        return `${this.canonical()}?lan=${language}&SNode=S0`;
    }
}
