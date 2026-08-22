import { EventRepository } from '../repositories/EventRepository.ts';
import { mapWithConcurrency } from '../../concurrency.ts';
import { Tournament } from '../../domain/Tournament.ts';
import { TournamentDirectory } from '../repositories/TournamentDirectory.ts';
import { TournamentProvider } from '../providers/TournamentProvider.ts';

export interface RefreshReport {
    /** Tournaments attempted this tick. */
    checked: number;
    /** Of those, how many had actually moved on to a new round. */
    published: number;
    /** Of those, how many could not be reached or parsed. */
    failed: number;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 4;

/**
 * One pass over the tournaments people are following. This is the whole reason
 * the backend moved off the phones: the work here is proportional to the number
 * of tournaments, and stays there however many users show up.
 */
export class RefreshService {
    constructor(
        private readonly tournamentProvider: TournamentProvider,
        private readonly eventRepository: EventRepository,
        private readonly directory: TournamentDirectory,
        private readonly concurrency: number = DEFAULT_CONCURRENCY,
    ) {}

    async refreshAll(
        batchSize: number = DEFAULT_BATCH_SIZE,
    ): Promise<RefreshReport> {
        const urls = await this.directory.dueForRefresh(batchSize);

        if (urls.length === 0) {
            return { checked: 0, published: 0, failed: 0 };
        }

        // One unreachable tournament must not abort the tick, so each check
        // settles on its own and a failure counts as "nothing new".
        const outcomes = await mapWithConcurrency(urls, this.concurrency, url =>
            this.refresh(url).catch(error => {
                console.warn(`Failed to refresh tournament ${url}`, error);

                return null;
            }),
        );

        // After the batch, in one statement, and for failures too: a tournament
        // whose page has been taken down would otherwise sit at the head of the
        // queue forever and starve everything behind it.
        await this.directory.markChecked(urls, new Date());

        return {
            checked: urls.length,
            published: outcomes.filter(published => published === true).length,
            failed: outcomes.filter(published => published === null).length,
        };
    }

    /** Returns whether this tournament had moved on to a new round. */
    private async refresh(canonicalUrl: string): Promise<boolean> {
        const events = await this.eventRepository.load(
            Tournament.TYPE,
            Tournament.idFor(canonicalUrl),
        );

        const tournament = Tournament.rehydrate(canonicalUrl, events);

        const details =
            await this.tournamentProvider.getTournamentDetails(canonicalUrl);

        if (!tournament.observe(details.toDomain())) {
            return false;
        }

        await this.eventRepository.save(tournament);

        return true;
    }
}
