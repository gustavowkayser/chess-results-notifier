import { AndroidNotifier } from './infrastructure/AndroidNotifier.ts';
import { MonitoringService } from './application/services/MonitoringService.ts';
import { SupabaseTournamentRepository } from './infrastructure/supabase/SupabaseTournamentRepository.ts';
import { TournamentService } from './application/services/TournamentService.ts';

// Reached across into the backend on purpose: what counts as a tournament URL
// has to be one definition, and the Edge Functions cannot import out of src/.
// ChessResultsUrl pulls in no HTML parsing, so the app bundle stays as small as
// it was.
import { ChessResultsUrl } from '../../supabase/functions/_shared/chessresults/ChessResultsUrl.ts';

const tournamentRepository = new SupabaseTournamentRepository();
const notifier = new AndroidNotifier();

const tournamentService = new TournamentService(tournamentRepository);

const monitoringService = new MonitoringService(tournamentRepository, notifier);

/**
 * Whether text names a chess-results tournament. Exported so the search screen
 * can tell a URL from a player name without a second copy of the pattern.
 */
const isTournamentUrl = (text: string): boolean =>
    ChessResultsUrl.isTournamentUrl(text);

export { tournamentService, monitoringService, isTournamentUrl };
