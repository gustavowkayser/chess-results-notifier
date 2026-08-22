-- The refresh job's work queue: tournaments somebody still follows, least
-- recently checked first.
--
-- Expressed here rather than assembled as a PostgREST embedding because the
-- interesting parts — the semi-join on active subscriptions, and never-checked
-- rows sorting ahead of stale ones — read as an intent in SQL and as a puzzle
-- anywhere else.

CREATE FUNCTION public.tournaments_due_for_refresh(batch_size INTEGER)
    RETURNS SETOF TEXT
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = ''
AS $$
    SELECT t.url
      FROM public.tournaments t
     WHERE EXISTS (
               SELECT 1
                 FROM public.subscriptions s
                WHERE s.tournament_url = t.url
                  AND s.active
           )
     ORDER BY t.last_checked_at ASC NULLS FIRST
     LIMIT batch_size;
$$;

-- Only the refresh job has any use for this, and it runs as service_role.
REVOKE EXECUTE ON FUNCTION public.tournaments_due_for_refresh(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.tournaments_due_for_refresh(INTEGER) TO service_role;
