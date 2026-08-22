-- The whole point of the migration off the device: one scrape per tournament,
-- here, instead of one per tournament per user out on every phone.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- The URL and the service key are not in this file on purpose — it is committed.
-- Both are read from Vault at run time and have to be created once per project:
--
--   SELECT vault.create_secret(
--       'https://<project-ref>.supabase.co/functions/v1/refresh-tournaments',
--       'refresh_tournaments_url');
--   SELECT vault.create_secret('<service-role-key>', 'refresh_tournaments_key');
--
-- The key has to be the exact value the functions see as
-- SUPABASE_SERVICE_ROLE_KEY: refresh-tournaments compares the two rather than
-- decoding claims, so that it keeps working if the project moves to the newer
-- secret key format.
--
-- Until both secrets exist the job runs and fails, which cron.job_run_details
-- records.
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
            'Authorization', 'Bearer ' || (SELECT decrypted_secret
                                             FROM vault.decrypted_secrets
                                            WHERE name = 'refresh_tournaments_key')
        ),
        body    := '{}'::JSONB,
        -- Longer than the function's own budget, so a slow chess-results does
        -- not leave pg_net reporting a timeout for work that actually finished.
        timeout_milliseconds := 55000
    );
    $job$
);
