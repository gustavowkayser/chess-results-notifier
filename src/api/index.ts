import { AndroidNotifier } from './infrastructure/AndroidNotifier.ts';
import { ChessResultsProvider } from './infrastructure/ChessResultsProvider.ts';
import { MonitoringService } from './application/services/MonitoringService.ts';
import { OpSqliteDatabase } from './infrastructure/sqlite/OpSqliteDatabase.ts';
import { SqliteEventRepository } from './infrastructure/SqliteEventRepository.ts';
import { TournamentService } from './application/services/TournamentService.ts';

const tournamentProvider = new ChessResultsProvider();
const eventRepository = new SqliteEventRepository(new OpSqliteDatabase());
const notifier = new AndroidNotifier();

const tournamentService = new TournamentService(
    tournamentProvider,
    eventRepository,
);

const monitoringService = new MonitoringService(
    tournamentProvider,
    eventRepository,
    notifier,
);

export { tournamentService, monitoringService };
