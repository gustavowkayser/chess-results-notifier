import { ChessResultsProvider } from '../_shared/chessresults/ChessResultsProvider.ts';
import { RefreshService } from '../_shared/application/services/RefreshService.ts';
import { requireCronSecret, serviceClient } from '../_shared/edge/auth.ts';
import { json, serve } from '../_shared/edge/http.ts';
import { SupabaseEventRepository } from '../_shared/edge/SupabaseEventRepository.ts';
import { SupabaseTournamentDirectory } from '../_shared/edge/SupabaseTournamentDirectory.ts';

const client = serviceClient();

const refresh = new RefreshService(
    new ChessResultsProvider(),
    new SupabaseEventRepository(client),
    new SupabaseTournamentDirectory(client),
);

/**
 * One pass over every tournament somebody follows. Invoked once a minute by
 * pg_cron — see supabase/migrations/20260820120500_schedule_refresh.sql — and
 * by nobody else.
 */
serve(async request => {
    requireCronSecret(request);

    const report = await refresh.refreshAll();

    return json(report);
});
