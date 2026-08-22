import { ChessResultsProvider } from '../_shared/chessresults/ChessResultsProvider.ts';
import { ChessResultsUrl } from '../_shared/chessresults/ChessResultsUrl.ts';
import { RegistrationService } from '../_shared/application/services/RegistrationService.ts';
import { requireUser, serviceClient } from '../_shared/edge/auth.ts';
import {
    HttpError,
    json,
    serve,
    tournamentUrlFrom,
} from '../_shared/edge/http.ts';
import { SupabaseEventRepository } from '../_shared/edge/SupabaseEventRepository.ts';

// Built once per worker rather than per request: both are stateless, and the
// service client holds the connection pool.
const registrations = new RegistrationService(
    new ChessResultsProvider(),
    new SupabaseEventRepository(serviceClient()),
);

serve(async request => {
    const userId = await requireUser(request);
    const url = await tournamentUrlFrom(request);

    // The one caller mistake worth naming as such. A tournament that exists but
    // cannot be reached is our problem, not theirs, and falls through to a 500
    // carrying the reason chess-results gave.
    if (!ChessResultsUrl.isTournamentUrl(url)) {
        throw new HttpError(400, `Not a chess-results tournament URL: "${url}"`);
    }

    const details = await registrations.register(userId, url);

    return json({
        name: details.name,
        currentRound: details.currentRound,
        totalRounds: details.totalRounds,
    });
});
