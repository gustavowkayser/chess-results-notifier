import { DomainEvent } from '../../domain/DomainEvent.ts';

export interface EventRepository {
    save(event: DomainEvent): Promise<void>;
}
