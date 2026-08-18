/**
 * Serializes async work. A SQLite connection has one transaction slot, so
 * overlapping BEGINs on the same connection fail with "cannot start a
 * transaction within a transaction". MonitoringService checks every tournament
 * concurrently, so the adapters queue transactions rather than making callers
 * know that.
 */
export class Mutex {
    private tail: Promise<unknown> = Promise.resolve();

    run<T>(work: () => Promise<T>): Promise<T> {
        // Run regardless of whether the previous entry resolved or rejected,
        // so one failed transaction does not wedge the queue.
        const result = this.tail.then(work, work);

        this.tail = result.catch(() => undefined);

        return result;
    }
}
