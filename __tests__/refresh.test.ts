/**
 * @format
 */

import { InMemoryBackend } from '../test-support/InMemoryBackend';
import { RefreshService } from '../supabase/functions/_shared/application/services/RefreshService';
import { RegistrationService } from '../supabase/functions/_shared/application/services/RegistrationService';
import { StubTournamentProvider } from '../test-support/StubTournamentProvider';
import { Subscription } from '../supabase/functions/_shared/domain/Subscription';
import { Tournament } from '../supabase/functions/_shared/domain/Tournament';
import { TournamentDetailsDTO } from '../supabase/functions/_shared/application/dtos/TournamentDetailsDTO';

const SAMPLE_URL = 'https://s1.chess-results.com/tnr1234567.aspx';
const OTHER_URL = 'https://s2.chess-results.com/tnr7654321.aspx';

const ADA = 'ada';
const BORIS = 'boris';

// One backend, two services, as the deployed functions have it: they share a
// database and nothing else.
const build = (backend: InMemoryBackend, provider = new StubTournamentProvider()) => ({
    provider,
    registrations: new RegistrationService(provider, backend),
    refresh: new RefreshService(provider, backend, backend),
});

let backend: InMemoryBackend;

beforeEach(() => {
    backend = new InMemoryBackend();
});

test('registering opens a shared stream and a private one', async () => {
    const { registrations } = build(backend);

    const details = await registrations.register(ADA, SAMPLE_URL);

    expect(details.name).toBe('Mock Tournament Name');

    await expect(backend.typesOn(Tournament.TYPE, SAMPLE_URL)).resolves.toEqual(
        ['TournamentDiscovered'],
    );
    await expect(
        backend.typesOn(Subscription.TYPE, Subscription.idFor(ADA, SAMPLE_URL)),
    ).resolves.toEqual(['TournamentRegistered']);
});

test('query parameters collapse to one stream', async () => {
    const { registrations, provider } = build(backend);

    await registrations.register(ADA, `${SAMPLE_URL}?lan=1&SNode=S0`);
    await registrations.register(ADA, SAMPLE_URL);

    expect(provider.fetched).toEqual([SAMPLE_URL]);
    await expect(backend.typesOn(Tournament.TYPE, SAMPLE_URL)).resolves.toEqual(
        ['TournamentDiscovered'],
    );
});

// The whole reason the backend moved off the phones: a second follower costs
// chess-results nothing.
test('a second follower does not cause a second scrape', async () => {
    const { registrations, refresh, provider } = build(backend);

    await registrations.register(ADA, SAMPLE_URL);
    await registrations.register(BORIS, SAMPLE_URL);

    expect(provider.fetched).toEqual([SAMPLE_URL]);

    provider.fetched.length = 0;
    await refresh.refreshAll();

    expect(provider.fetched).toEqual([SAMPLE_URL]);
});

test('a refresh publishes a round once, when it moves on', async () => {
    const { registrations, refresh } = build(backend);

    await registrations.register(ADA, SAMPLE_URL);

    // The stub advances the round on every poll, so this pass sees a new one.
    await expect(refresh.refreshAll()).resolves.toEqual({
        checked: 1,
        published: 1,
        failed: 0,
    });

    await expect(backend.typesOn(Tournament.TYPE, SAMPLE_URL)).resolves.toEqual(
        ['TournamentDiscovered', 'RoundPublished'],
    );
});

test('a refresh that sees no new round writes nothing', async () => {
    const { registrations } = build(backend);

    await registrations.register(ADA, SAMPLE_URL);

    // A second service over the same store but with its own provider, which
    // restarts at round 1 — i.e. the round has not moved on.
    const stale = build(backend);

    await expect(stale.refresh.refreshAll()).resolves.toEqual({
        checked: 1,
        published: 0,
        failed: 0,
    });

    await expect(backend.typesOn(Tournament.TYPE, SAMPLE_URL)).resolves.toEqual(
        ['TournamentDiscovered'],
    );
});

test('streams replay in the order they were appended', async () => {
    const { registrations, refresh } = build(backend);

    await registrations.register(ADA, SAMPLE_URL);
    await registrations.register(ADA, OTHER_URL);

    await refresh.refreshAll();
    await refresh.refreshAll();

    // Both streams are asserted: a refresh runs its batch concurrently, and a
    // failed write on the second tournament would otherwise go unnoticed.
    for (const url of [SAMPLE_URL, OTHER_URL]) {
        const events = await backend.load(Tournament.TYPE, url);

        expect(events.map(event => event.type)).toEqual([
            'TournamentDiscovered',
            'RoundPublished',
            'RoundPublished',
        ]);
        expect(events.map(event => event.payload().round)).toEqual([
            undefined,
            2,
            3,
        ]);
        expect(events.every(event => event.aggregateId === url)).toBe(true);
    }
});

test('a tournament nobody follows any more stops being polled', async () => {
    const { registrations, refresh, provider } = build(backend);

    await registrations.register(ADA, SAMPLE_URL);
    await registrations.register(ADA, OTHER_URL);

    await registrations.unregister(ADA, SAMPLE_URL);

    // The stream is kept: unfollowing appends rather than deleting.
    await expect(
        backend.typesOn(Subscription.TYPE, Subscription.idFor(ADA, SAMPLE_URL)),
    ).resolves.toEqual(['TournamentRegistered', 'TournamentUnregistered']);

    provider.fetched.length = 0;
    await refresh.refreshAll();

    expect(provider.fetched).toEqual([OTHER_URL]);
});

test('a tournament someone else still follows keeps being polled', async () => {
    const { registrations, refresh, provider } = build(backend);

    await registrations.register(ADA, SAMPLE_URL);
    await registrations.register(BORIS, SAMPLE_URL);
    await registrations.unregister(ADA, SAMPLE_URL);

    provider.fetched.length = 0;
    await refresh.refreshAll();

    expect(provider.fetched).toEqual([SAMPLE_URL]);
});

test('an unreachable tournament does not abort the pass', async () => {
    const { registrations } = build(backend);

    await registrations.register(ADA, SAMPLE_URL);
    await registrations.register(ADA, OTHER_URL);

    const failing = {
        canonicalUrl: (url: string) => url,
        getTournamentDetails: jest.fn(async (url: string) => {
            if (url === SAMPLE_URL) {
                throw new Error('network down');
            }

            return new TournamentDetailsDTO('Mock Tournament Name', 2, 9);
        }),
    };

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const refresh = new RefreshService(failing, backend, backend);

    await expect(refresh.refreshAll()).resolves.toEqual({
        checked: 2,
        published: 1,
        failed: 1,
    });

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
});

// A tournament whose page has been taken down must not sit at the head of the
// queue forever and starve everything behind it.
test('a batch takes the least recently checked first, failures included', async () => {
    const { registrations } = build(backend);

    await registrations.register(ADA, SAMPLE_URL);
    await registrations.register(ADA, OTHER_URL);

    const provider = {
        canonicalUrl: (url: string) => url,
        getTournamentDetails: jest.fn(async (url: string) => {
            throw new Error(`gone: ${url}`);
        }),
    };

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const refresh = new RefreshService(provider, backend, backend);

    await refresh.refreshAll(1);
    await refresh.refreshAll(1);

    warn.mockRestore();

    expect(
        provider.getTournamentDetails.mock.calls.map(([url]) => url),
    ).toEqual([SAMPLE_URL, OTHER_URL]);
});
