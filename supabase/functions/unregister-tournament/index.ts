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

// The provider is here only to canonicalise the URL — unfollowing never
// touches chess-results.
const registrations = new RegistrationService(
    new ChessResultsProvider(),
    new SupabaseEventRepository(serviceClient()),
);

serve(async request => {
    const userId = await requireUser(request);
    const url = await tournamentUrlFrom(request);

    if (!ChessResultsUrl.isTournamentUrl(url)) {
        throw new HttpError(400, `Not a chess-results tournament URL: "${url}"`);
    }

    await registrations.unregister(userId, url);

    return json({ unregistered: true });
});
