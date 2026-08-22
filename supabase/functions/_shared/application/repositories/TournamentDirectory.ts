/**
 * The read-model side of refreshing: which tournaments are worth scraping, and
 * a note of when we last tried.
 *
 * Separate from EventRepository because it answers questions about derived
 * state — "does anyone still follow this?" — that the log cannot answer without
 * replaying every stream in the system.
 */
export interface TournamentDirectory {
    /**
     * Canonical URLs with at least one active subscriber, least recently
     * checked first. The batch size is what stops one tick from trying to
     * scrape the entire catalogue.
     */
    dueForRefresh(batchSize: number): Promise<string[]>;

    /**
     * Records an attempt, successful or not. Marking a failure matters: a
     * tournament whose page has been taken down would otherwise stay at the
     * head of the queue forever and starve everything behind it.
     */
    markChecked(tournamentUrls: string[], checkedAt: Date): Promise<void>;
}
