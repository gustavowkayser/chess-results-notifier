import { parse } from 'node-html-parser';
import { TournamentDetailsDTO } from '../application/dtos/TournamentDetailsDTO.ts';

// A round link is art=2 exactly — art=20 or art=25 must not match.
const ROUND_LINK = /[?&]art=2(?:&|$)/;
const ROUND_NUMBER = /[?&]rd=(\d+)/;

// The round count trails the label as "/7". The prefix in front of it is
// translated ("Rd.5/7", "Тур5/7", "5 轮/7", "ج. 5 /7"), so only the digits
// after the slash are read.
const TOTAL_ROUNDS = /\/\s*(\d+)\s*$/;

/**
 * Reads tournament details out of a chess-results overview page.
 *
 * Takes HTML rather than a URL so the scraping rules — the part most likely to
 * break when the site changes — can be tested against saved pages.
 */
export class TournamentPageParser {
    public static parse(html: string): TournamentDetailsDTO {
        const root = parse(html);

        const heading = root.querySelector('h2');

        if (heading === null) {
            throw new Error(
                'No <h2> on the page: not a tournament page, or the layout changed',
            );
        }

        const name = heading.text.replace(/\s+/g, ' ').trim();
        const roundLinks = TournamentPageParser.roundLinks(root);

        // No round links at all means no pairings have been published yet, which
        // is a normal state for a tournament that has not started.
        const currentRound = roundLinks.reduce(
            (highest, link) => Math.max(highest, link.round),
            0,
        );

        return new TournamentDetailsDTO(
            name,
            currentRound,
            TournamentPageParser.totalRounds(roundLinks, currentRound),
        );
    }

    private static roundLinks(
        root: ReturnType<typeof parse>,
    ): { round: number; label: string }[] {
        return root
            .querySelectorAll('a')
            .map(anchor => ({
                href: anchor.getAttribute('href') ?? '',
                label: anchor.text,
            }))
            .filter(link => ROUND_LINK.test(link.href))
            .map(link => ({
                round: Number(ROUND_NUMBER.exec(link.href)?.[1] ?? 0),
                label: link.label,
            }))
            .filter(link => link.round > 0);
    }

    private static totalRounds(
        roundLinks: { round: number; label: string }[],
        currentRound: number,
    ): number {
        const latest = roundLinks.find(link => link.round === currentRound);
        const total = TOTAL_ROUNDS.exec(latest?.label.trim() ?? '');

        // Only the latest round's label carries the total. Without it the best
        // available answer is the round we can see.
        return total === null ? currentRound : Number(total[1]);
    }
}
