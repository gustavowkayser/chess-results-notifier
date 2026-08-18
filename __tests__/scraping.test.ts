/**
 * @format
 */

import { readFileSync } from 'fs';
import { ChessResultsProvider } from '../src/api/infrastructure/ChessResultsProvider';
import { ChessResultsUrl } from '../src/api/infrastructure/chessresults/ChessResultsUrl';
import { TournamentPageParser } from '../src/api/infrastructure/chessresults/TournamentPageParser';

const fixture = (name: string) =>
    readFileSync(`${__dirname}/fixtures/chess-results-${name}.html`, 'utf8');

describe('TournamentPageParser', () => {
    test('reads the round in progress and the total', () => {
        const details = TournamentPageParser.parse(fixture('in-progress'));

        expect(details.name).toBe(
            'JOGGA School Chess Championship 2026 (Junior Boys)',
        );
        expect(details.currentRound).toBe(5);
        expect(details.totalRounds).toBe(7);
    });

    test('reads a finished tournament as being on its last round', () => {
        const details = TournamentPageParser.parse(fixture('finished'));

        expect(details.name).toBe('Campeonato Goiano Blitz 2026 3a Etapa');
        expect(details.currentRound).toBe(9);
        expect(details.totalRounds).toBe(9);
    });

    test('reports round zero when no pairings are published yet', () => {
        const details = TournamentPageParser.parse(fixture('no-rounds'));

        expect(details.name).toBe('NUSS Team Chess Tournament 2026 [23 August]');
        expect(details.currentRound).toBe(0);
    });

    // The round label is translated — "Rd.5/7" in English, "Тур5/7" in Russian,
    // "5 轮/7" in Chinese — so the round is read from the href instead. This is
    // the guard for that: it fails against any parser keyed on "Rd.".
    test('reads the same rounds from a page in another language', () => {
        const english = TournamentPageParser.parse(fixture('in-progress'));
        const russian = TournamentPageParser.parse(fixture('russian'));

        expect(russian.currentRound).toBe(english.currentRound);
        expect(russian.totalRounds).toBe(english.totalRounds);
        expect(russian.name).toBe(english.name);
    });

    test('decodes HTML entities in the tournament name', () => {
        const details = TournamentPageParser.parse(
            '<html><body><h2>V TORNEO &quot;A&quot; &#9823;</h2></body></html>',
        );

        expect(details.name).toBe('V TORNEO "A" ♟');
    });

    test('does not mistake art=20 for a round link', () => {
        const details = TournamentPageParser.parse(
            `<html><body><h2>T</h2>
             <a href="x.aspx?lan=1&art=20&rd=99">nonsense</a></body></html>`,
        );

        expect(details.currentRound).toBe(0);
    });

    test('rejects a page that is not a tournament', () => {
        expect(() => TournamentPageParser.parse('<html><body/></html>')).toThrow(
            /No <h2>/,
        );
    });
});

describe('ChessResultsUrl', () => {
    test('keeps the mirror but drops incidental query parameters', () => {
        const url = ChessResultsUrl.parse(
            'https://s2.chess-results.com/tnr1477210.aspx?lan=10&art=2&rd=3',
        );

        expect(url.canonical()).toBe(
            'https://s2.chess-results.com/tnr1477210.aspx',
        );
        expect(url.pageUrl(1)).toBe(
            'https://s2.chess-results.com/tnr1477210.aspx?lan=1&SNode=S0',
        );
    });

    test('collapses the same tournament reached through different links', () => {
        const bare = ChessResultsUrl.parse(
            'https://s1.chess-results.com/tnr1477210.aspx',
        );
        const decorated = ChessResultsUrl.parse(
            'https://s1.chess-results.com/tnr1477210.aspx?lan=10&SNode=S0',
        );

        expect(decorated.canonical()).toBe(bare.canonical());
    });

    test('rejects anything that is not a chess-results tournament', () => {
        for (const url of [
            'https://example.com/tnr1477210.aspx',
            'https://s1.chess-results.com/Default.aspx?lan=1',
            'not a url',
        ]) {
            expect(() => ChessResultsUrl.parse(url)).toThrow(/chess-results/);
        }
    });
});

describe('ChessResultsProvider', () => {
    const SAMPLE_URL = 'https://s1.chess-results.com/tnr1475106.aspx';

    test('requests the configured language and parses the response', async () => {
        const requested: string[] = [];
        const provider = new ChessResultsProvider(11, async url => {
            requested.push(url);

            return fixture('russian');
        });

        const details = await provider.getTournamentDetails(SAMPLE_URL);

        expect(requested).toEqual([`${SAMPLE_URL}?lan=11&SNode=S0`]);
        expect(details.currentRound).toBe(5);
        expect(details.totalRounds).toBe(7);
    });

    test('propagates a failed request', async () => {
        const provider = new ChessResultsProvider(1, async () => {
            throw new Error('chess-results responded 503');
        });

        await expect(provider.getTournamentDetails(SAMPLE_URL)).rejects.toThrow(
            /503/,
        );
    });
});
