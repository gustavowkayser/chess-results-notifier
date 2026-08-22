import { TournamentRepository } from '../repositories/TournamentRepository.ts';
import { TrackedTournament } from '../../domain/TrackedTournament.ts';

/**
 * What the screens talk to. There is no logic left on this side of the wire —
 * registering scrapes and appends events on the server now — but the screens
 * keep depending on this name rather than on Supabase, which is what lets them
 * be rendered in a test with a plain object.
 */
export class TournamentService {
    constructor(private readonly tournaments: TournamentRepository) {}

    registerTournament(tournamentUrl: string): Promise<void> {
        return this.tournaments.register(tournamentUrl);
    }

    /**
     * Stops following a tournament. Nothing is deleted: the server appends,
     * and the tournament itself carries on being refreshed for whoever else
     * is following it.
     */
    unregisterTournament(tournamentUrl: string): Promise<void> {
        return this.tournaments.unregister(tournamentUrl);
    }

    listTournaments(): Promise<TrackedTournament[]> {
        return this.tournaments.list();
    }
}
