import { AndroidNotifier } from './infrastructure/AndroidNotifier.ts';
import { AsyncStorageEventRepository } from './infrastructure/AsyncStorageEventRepository.ts';
import { ChessResultsProvider } from './infrastructure/ChessResultsProvider.ts';
import { MonitoringService } from './application/services/MonitoringService.ts';
import { TournamentService } from './application/services/TournamentService.ts';

const tournamentProvider = new ChessResultsProvider();
const eventRepository = new AsyncStorageEventRepository();
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
