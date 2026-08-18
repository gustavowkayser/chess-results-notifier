import { Notifier } from '../notifiers/Notifier.ts';
import { Tournament } from '../../domain/Tournament.ts';
import { TournamentProvider } from '../providers/TournamentProvider.ts';
import { EventRepository } from '../repositories/EventRepository.ts';

export class MonitoringService {
    constructor(
        private readonly tournamentProvider: TournamentProvider,
        private readonly eventRepository: EventRepository,
        private readonly notifier: Notifier,
    ) {}

    /**
     * Checks every registered tournament and notifies about the ones whose
     * round moved on. Returns how many notifications were sent.
     */
    async checkAll(): Promise<number> {
        const ids = await this.eventRepository.listAggregateIds();

        // One unreachable tournament must not abort the tick, so each check
        // settles on its own and a failure counts as "nothing to notify".
        const notified = await Promise.all(
            ids.map(id =>
                this.check(id).catch(error => {
                    console.warn(`Failed to check tournament ${id}`, error);

                    return false;
                }),
            ),
        );

        return notified.filter(Boolean).length;
    }

    private async check(aggregateId: string): Promise<boolean> {
        const events = await this.eventRepository.load(aggregateId);

        if (!events.length) return false;

        const tournament = Tournament.rehydrate(aggregateId, events);

        const details = await this.tournamentProvider.getTournamentDetails(
            tournament.getUrl(),
        );

        const notification = tournament.observe(details.toDomain());

        if (!notification) return false;

        await this.eventRepository.save(tournament);
        await this.notifier.notify(notification);

        return true;
    }
}
