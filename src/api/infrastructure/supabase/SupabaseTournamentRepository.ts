import { FunctionsHttpError } from '@supabase/supabase-js';
import { PublishedRound } from '../../domain/PublishedRound.ts';
import { TournamentRepository } from '../../application/repositories/TournamentRepository.ts';
import { TrackedTournament } from '../../domain/TrackedTournament.ts';
import { ensureSession } from './session.ts';
import { supabase } from './client.ts';

// The foreign key from subscriptions to tournaments is what lets one request
// carry both halves; !inner drops a subscription whose tournament vanished.
const TRACKED = `tournament_url,
                 tournaments!inner (name, current_round, total_rounds, updated_at)`;

interface TrackedRow {
    tournament_url: string;
    tournaments: {
        name: string;
        current_round: number;
        total_rounds: number;
        updated_at: string | null;
    };
}

interface PendingRoundRow {
    tournament_url: string;
    name: string;
    current_round: number;
    total_rounds: number;
}

export class SupabaseTournamentRepository implements TournamentRepository {
    async list(): Promise<TrackedTournament[]> {
        await ensureSession();

        const { data, error } = await supabase
            .from('subscriptions')
            .select(TRACKED)
            // Unfollowing appends an event rather than deleting a row, so the
            // inactive ones are still here and have to be filtered out.
            .eq('active', true)
            .order('created_at');

        if (error) {
            throw new Error(
                `Could not load your tournaments: ${error.message}`,
            );
        }

        return ((data ?? []) as unknown as TrackedRow[]).map(row => ({
            url: row.tournament_url,
            name: row.tournaments.name,
            currentRound: row.tournaments.current_round,
            totalRounds: row.tournaments.total_rounds,
            updatedAt: row.tournaments.updated_at
                ? new Date(row.tournaments.updated_at)
                : null,
        }));
    }

    register(tournamentUrl: string): Promise<void> {
        return this.invoke('register-tournament', tournamentUrl);
    }

    unregister(tournamentUrl: string): Promise<void> {
        return this.invoke('unregister-tournament', tournamentUrl);
    }

    async claimPendingRounds(): Promise<PublishedRound[]> {
        await ensureSession();

        const { data, error } = await supabase.rpc('claim_pending_rounds');

        if (error) {
            throw new Error(
                `Could not check for new rounds: ${error.message}`,
            );
        }

        return ((data ?? []) as PendingRoundRow[]).map(row => ({
            tournamentUrl: row.tournament_url,
            name: row.name,
            currentRound: row.current_round,
            totalRounds: row.total_rounds,
        }));
    }

    private async invoke(
        functionName: string,
        tournamentUrl: string,
    ): Promise<void> {
        // Nothing here passes a token: supabase-js resolves one per request. But
        // it resolves whatever is stored, and on a cold start — which is every
        // headless tick — nothing is, until this has run.
        await ensureSession();

        const { error } = await supabase.functions.invoke(functionName, {
            body: { url: tournamentUrl },
        });

        if (error) {
            throw new Error(await reasonFor(error));
        }
    }
}

/**
 * invoke() reports every non-2xx as the same opaque sentence, with the response
 * tucked away on the error. The search screen shows whatever comes back, and
 * "chess-results responded 404" is worth digging out.
 */
async function reasonFor(error: Error): Promise<string> {
    if (!(error instanceof FunctionsHttpError)) {
        return error.message;
    }

    try {
        const body = await error.context.json();

        if (typeof body?.error === 'string') {
            return body.error;
        }
    } catch {
        // No JSON body, or it has been consumed already: the generic message is
        // all there is.
    }

    return error.message;
}
