import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HttpError, requireEnv } from './http.ts';

/**
 * A client that bypasses RLS. Every write in this backend goes through one:
 * the policies grant clients SELECT and nothing else.
 */
export function serviceClient(): SupabaseClient {
    return createClient(
        requireEnv('SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { persistSession: false, autoRefreshToken: false } },
    );
}

/**
 * The calling user's id. The platform has already rejected an invalid JWT by
 * the time we get here (verify_jwt), but the id itself still has to come from
 * the token rather than from anything the caller put in the body — it is what
 * every subscription row is keyed on.
 */
export async function requireUser(request: Request): Promise<string> {
    const authorization = request.headers.get('Authorization');

    if (!authorization) {
        throw new HttpError(401, 'Missing Authorization header');
    }

    const client = createClient(
        requireEnv('SUPABASE_URL'),
        requireEnv('SUPABASE_ANON_KEY'),
        {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: authorization } },
        },
    );

    const { data, error } = await client.auth.getUser();

    if (error || !data.user) {
        throw new HttpError(401, 'Not signed in');
    }

    return data.user.id;
}

/**
 * Rejects anything but the scheduler.
 *
 * A shared secret of our own rather than the project's service key. Two reasons:
 * the service key's value depends on whether the project is on legacy JWT keys
 * or the newer sb_secret_ ones, which is not something this function should have
 * an opinion about; and if this one leaks it buys a refresh and nothing else,
 * where the service key would buy the database.
 *
 * It is the only gate — refresh-tournaments runs with verify_jwt off, because
 * any signed-in user holds a valid JWT and none of them should be able to make
 * us scrape.
 */
export function requireCronSecret(request: Request): void {
    const presented = request.headers.get('x-cron-secret');

    if (
        presented === null ||
        !matches(presented, requireEnv('CRON_SECRET'))
    ) {
        throw new HttpError(403, 'Not authorised');
    }
}

/** Comparison whose duration does not depend on where the first byte differs. */
function matches(presented: string, expected: string): boolean {
    if (presented.length !== expected.length) {
        return false;
    }

    let difference = 0;

    for (let index = 0; index < expected.length; index++) {
        // Bitwise on purpose: || and === would stop at the first mismatch, which
        // is exactly the timing signal this is here to remove.
        // eslint-disable-next-line no-bitwise
        difference |= presented.charCodeAt(index) ^ expected.charCodeAt(index);
    }

    return difference === 0;
}
