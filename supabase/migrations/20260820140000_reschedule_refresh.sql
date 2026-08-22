-- Supersedes the job scheduled in 20260820120500_schedule_refresh.sql, which
-- authenticated with the project's service key.
--
-- That key's value depends on whether the project is on legacy JWT keys or the
-- newer sb_secret_ ones — this one is on both, and the value the Edge Function
-- sees in SUPABASE_SERVICE_ROLE_KEY turned out not to be the one the CLI hands
-- out, so the two ends could not be made to agree. A secret of our own settles
-- it, and one that buys nothing but a refresh is the better thing to be sending
-- over the wire once a minute anyway.
--
-- cron.schedule upserts on the job name, so this replaces the job in place.
--
-- Set up once per project, with the same value on both sides:
--
--   supabase secrets set CRON_SECRET=<random>
--   select vault.create_secret('<random>', 'refresh_tournaments_secret');
--   select vault.create_secret(
--       'https://<project-ref>.supabase.co/functions/v1/refresh-tournaments',
--       'refresh_tournaments_url');

SELECT cron.schedule(
    'refresh-tournaments',
    '* * * * *',
    $job$
    SELECT net.http_post(
        url     := (SELECT decrypted_secret
                      FROM vault.decrypted_secrets
                     WHERE name = 'refresh_tournaments_url'),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (SELECT decrypted_secret
                                FROM vault.decrypted_secrets
                               WHERE name = 'refresh_tournaments_secret')
        ),
        body    := '{}'::JSONB,
        -- Longer than the function's own budget, so a slow chess-results does
        -- not leave pg_net reporting a timeout for work that actually finished.
        timeout_milliseconds := 55000
    );
    $job$
);
