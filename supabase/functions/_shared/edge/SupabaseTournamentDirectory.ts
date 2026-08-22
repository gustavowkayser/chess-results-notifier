import { SupabaseClient } from '@supabase/supabase-js';
import { TournamentDirectory } from '../application/repositories/TournamentDirectory.ts';

export class SupabaseTournamentDirectory implements TournamentDirectory {
    constructor(private readonly client: SupabaseClient) {}

    async dueForRefresh(batchSize: number): Promise<string[]> {
        const { data, error } = await this.client.rpc(
            'tournaments_due_for_refresh',
            { batch_size: batchSize },
        );

        if (error) {
            throw new Error(
                `Failed to list tournaments due for refresh: ${error.message}`,
            );
        }

        return (data ?? []) as string[];
    }

    async markChecked(
        tournamentUrls: string[],
        checkedAt: Date,
    ): Promise<void> {
        if (tournamentUrls.length === 0) {
            return;
        }

        const { error } = await this.client
            .from('tournaments')
            .update({ last_checked_at: checkedAt.toISOString() })
            .in('url', tournamentUrls);

        if (error) {
            throw new Error(
                `Failed to record a refresh attempt: ${error.message}`,
            );
        }
    }
}
