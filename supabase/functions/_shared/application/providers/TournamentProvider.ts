import { TournamentDetailsDTO } from '../dtos/TournamentDetailsDTO.ts';

export interface TournamentProvider {
    getTournamentDetails(tournamentUrl: string): Promise<TournamentDetailsDTO>;

    /**
     * The identifying form of a tournament address, with anything incidental
     * (query parameters, mirror-specific noise) removed. The aggregate id is
     * derived from it, so registering one tournament through two different
     * links has to collapse to a single event stream.
     *
     * Lives on the port because the URL scheme belongs to the provider, not to
     * the application layer.
     */
    canonicalUrl(tournamentUrl: string): string;
}
