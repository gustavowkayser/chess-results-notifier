/**
 * A tournament the user is following, as the home screen needs it.
 *
 * Plain data rather than an aggregate: the event streams live on the server now,
 * and this is a row read out of a projection.
 */
export interface TrackedTournament {
    /** The canonical chess-results URL, which also identifies the card. */
    url: string;
    name: string;
    currentRound: number;
    totalRounds: number;

    /**
     * When the tournament last changed — not when it was last checked. A
     * refresh that finds no new round leaves this alone, by design.
     */
    updatedAt: Date | null;
}
