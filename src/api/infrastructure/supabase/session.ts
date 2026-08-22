import { supabase } from './client.ts';

let signingIn: Promise<string> | undefined;

/**
 * The signed-in user's id, signing in anonymously the first time.
 *
 * Memoized, the same way the SQLite store used to memoize its migration:
 * dependencies are wired synchronously at module scope and the monitoring task
 * can start on a cold JS context, so there is no earlier point to await. A
 * failed attempt clears the memo, or a first launch with no network would leave
 * the app unable to sign in until it was restarted.
 */
export function ensureSession(): Promise<string> {
    signingIn ??= signIn().catch(error => {
        signingIn = undefined;

        throw error;
    });

    return signingIn;
}

async function signIn(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        throw new Error(`Could not read the stored session: ${error.message}`);
    }

    if (data.session) {
        return data.session.user.id;
    }

    const created = await supabase.auth.signInAnonymously();

    if (created.error || !created.data.user) {
        throw new Error(
            'Could not start a session: ' +
                (created.error?.message ?? 'no user was returned'),
        );
    }

    return created.data.user.id;
}
