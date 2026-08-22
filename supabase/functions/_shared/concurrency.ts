/**
 * Runs `work` over `items`, never more than `limit` at a time, preserving input
 * order in the result.
 *
 * The point is politeness rather than throughput: firing a whole batch at
 * chess-results at once every minute would trade one kind of hammering for
 * another, which is not what this migration is for.
 *
 * A rejection from `work` propagates and leaves the remaining workers running,
 * so callers that need every item attempted should catch inside `work`.
 */
export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    work: (item: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;

    const worker = async (): Promise<void> => {
        for (let index = next++; index < items.length; index = next++) {
            results[index] = await work(items[index]);
        }
    };

    const workers = Math.max(1, Math.min(limit, items.length));

    await Promise.all(Array.from({ length: workers }, worker));

    return results;
}
