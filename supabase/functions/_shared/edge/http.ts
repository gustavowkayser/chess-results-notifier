/**
 * The thin HTTP shell the three functions share. Everything in this directory
 * is Deno-only — it is what the React Native tsconfig excludes, so the domain
 * and scraping code next door stays checkable by both toolchains.
 */

const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** An error with a status the client should actually see. */
export class HttpError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'HttpError';
    }
}

export function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
}

/**
 * Wraps a handler with the preflight reply and one error funnel, so each
 * function file is left with the two or three lines that are actually its own.
 *
 * The message is passed through to the client on purpose: the search screen
 * shows it, and "chess-results responded 404" is a better answer than
 * "something went wrong".
 */
export function serve(
    handler: (request: Request) => Promise<Response>,
): void {
    Deno.serve(async request => {
        if (request.method === 'OPTIONS') {
            return new Response('ok', { headers: CORS_HEADERS });
        }

        try {
            return await handler(request);
        } catch (error) {
            const status = error instanceof HttpError ? error.status : 500;

            // Only ours are expected; anything else is worth a log line.
            if (status >= 500) {
                console.error(error);
            }

            return json({ error: (error as Error).message }, status);
        }
    });
}

export function requireEnv(name: string): string {
    const value = Deno.env.get(name);

    if (!value) {
        throw new Error(`Missing environment variable ${name}`);
    }

    return value;
}

/** The one field every write endpoint takes. */
export async function tournamentUrlFrom(request: Request): Promise<string> {
    let body: { url?: unknown };

    try {
        body = await request.json();
    } catch {
        throw new HttpError(400, 'Expected a JSON body');
    }

    if (typeof body.url !== 'string' || body.url.trim() === '') {
        throw new HttpError(400, 'Expected a "url" string');
    }

    return body.url.trim();
}
