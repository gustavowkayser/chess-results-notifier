/**
 * A round this user has not been told about yet. Claiming one marks it told, so
 * the same round is never handed out twice.
 */
export interface PublishedRound {
    tournamentUrl: string;
    name: string;
    currentRound: number;
    totalRounds: number;
}
