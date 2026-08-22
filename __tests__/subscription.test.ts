import { Subscription } from '../supabase/functions/_shared/domain/Subscription.ts';
import { TournamentRegistered } from '../supabase/functions/_shared/domain/events/TournamentRegistered.ts';

const USER = '8f1c0c4a-0f4a-4d5e-9d2b-3a1e5c6b7d8e';
const URL = 'https://s1.chess-results.com/tnr1477210.aspx';

const fresh = () => Subscription.rehydrate(USER, URL, []);

describe('Subscription', () => {
    test('is inactive until the user registers', () => {
        expect(fresh().isActive()).toBe(false);
    });

    test('registering twice appends a single event', () => {
        const subscription = fresh();

        subscription.register();
        subscription.register();

        expect(subscription.pullEvents()).toHaveLength(1);
        expect(subscription.isActive()).toBe(true);
    });

    test('unregistering twice appends a single event', () => {
        const subscription = fresh();

        subscription.register();
        subscription.unregister();
        subscription.unregister();

        expect(subscription.pullEvents().map(event => event.type)).toEqual([
            'TournamentRegistered',
            'TournamentUnregistered',
        ]);
    });

    test('unregistering something never followed appends nothing', () => {
        const subscription = fresh();

        subscription.unregister();

        expect(subscription.pullEvents()).toHaveLength(0);
    });

    // One stream throughout, so the history of having been removed survives.
    test('registering again revives an unregistered subscription', () => {
        const subscription = fresh();

        subscription.register();
        subscription.unregister();
        subscription.register();

        expect(subscription.pullEvents().map(event => event.type)).toEqual([
            'TournamentRegistered',
            'TournamentUnregistered',
            'TournamentRegistered',
        ]);
        expect(subscription.isActive()).toBe(true);
    });

    // The projection reads the URL out of the payload rather than unpicking an
    // id that itself contains colons.
    test('carries the tournament URL in its events', () => {
        const subscription = fresh();

        subscription.register();

        const [event] = subscription.pullEvents();

        expect(event).toBeInstanceOf(TournamentRegistered);
        expect(event.payload()).toEqual({ tournamentUrl: URL });
        expect(subscription.id).toBe(`${USER}:${URL}`);
        expect(subscription.userId).toBe(USER);
    });
});
