import { ChessResultsUrl } from '../src/api/infrastructure/chessresults/ChessResultsUrl.ts';

describe('ChessResultsUrl.isTournamentUrl', () => {
    test('accepts a tournament URL on any mirror', () => {
        expect(
            ChessResultsUrl.isTournamentUrl(
                'https://s1.chess-results.com/tnr1477210.aspx',
            ),
        ).toBe(true);
        expect(
            ChessResultsUrl.isTournamentUrl(
                'https://s3.chess-results.com/tnr9.aspx?lan=1',
            ),
        ).toBe(true);
        expect(
            ChessResultsUrl.isTournamentUrl(
                'http://chess-results.com/tnr42.aspx',
            ),
        ).toBe(true);
    });

    test('ignores surrounding whitespace, as a paste often carries', () => {
        expect(
            ChessResultsUrl.isTournamentUrl(
                '  https://s1.chess-results.com/tnr1477210.aspx  ',
            ),
        ).toBe(true);
    });

    test('rejects prose and non-tournament pages', () => {
        expect(ChessResultsUrl.isTournamentUrl('Magnus Carlsen')).toBe(false);
        expect(ChessResultsUrl.isTournamentUrl('')).toBe(false);
        expect(
            ChessResultsUrl.isTournamentUrl('https://chess-results.com/'),
        ).toBe(false);
        expect(
            ChessResultsUrl.isTournamentUrl('https://lichess.org/tnr1.aspx'),
        ).toBe(false);
    });

    // Half-typed input is the common case on a search screen, and it must read
    // as "not yet", never as an error.
    test('rejects a partially typed URL', () => {
        expect(ChessResultsUrl.isTournamentUrl('https://s1.chess-res')).toBe(
            false,
        );
    });
});
