-- Keeps the read models in step with the log. Running as an AFTER INSERT
-- trigger rather than in the Edge Function is what makes an append and its
-- projection atomic: PostgREST gives Deno no transaction to wrap the two in.

CREATE FUNCTION public.project_event()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
AS $$
BEGIN
    CASE NEW.type

    WHEN 'TournamentDiscovered' THEN
        INSERT INTO public.tournaments (
            url, name, current_round, total_rounds, updated_at
        )
        VALUES (
            NEW.aggregate_id,
            NEW.payload ->> 'name',
            (NEW.payload ->> 'currentRound')::INTEGER,
            (NEW.payload ->> 'totalRounds')::INTEGER,
            NEW.occurred_at
        )
        -- Two users registering the same unknown tournament at once both get
        -- here. The rounds belong to RoundPublished, so only the name — which
        -- an organiser does rename — is refreshed.
        ON CONFLICT (url) DO UPDATE
            SET name = EXCLUDED.name;

    WHEN 'RoundPublished' THEN
        UPDATE public.tournaments
           SET current_round = (NEW.payload ->> 'round')::INTEGER,
               total_rounds  = (NEW.payload ->> 'totalRounds')::INTEGER,
               updated_at    = NEW.occurred_at
         WHERE url = NEW.aggregate_id;

    WHEN 'TournamentRegistered' THEN
        INSERT INTO public.subscriptions (
            user_id, tournament_url, active, last_notified_round, created_at
        )
        VALUES (
            NEW.user_id,
            NEW.payload ->> 'tournamentUrl',
            TRUE,
            -- Start level with what the user can already see on screen, so
            -- following a tournament mid-event does not announce a round that
            -- was published before they arrived. A missing tournament row is a
            -- foreign key violation here, which is the honest outcome: the
            -- caller appended TournamentRegistered before TournamentDiscovered.
            COALESCE(
                (SELECT t.current_round
                   FROM public.tournaments t
                  WHERE t.url = NEW.payload ->> 'tournamentUrl'),
                0
            ),
            NEW.occurred_at
        )
        -- Registering again revives a subscription that was unregistered, and
        -- re-levels it: rounds published while the user was away are history,
        -- not a backlog to fire off.
        ON CONFLICT (user_id, tournament_url) DO UPDATE
            SET active              = TRUE,
                last_notified_round = EXCLUDED.last_notified_round;

    WHEN 'TournamentUnregistered' THEN
        UPDATE public.subscriptions
           SET active = FALSE
         WHERE user_id        = NEW.user_id
           AND tournament_url = NEW.payload ->> 'tournamentUrl';

    ELSE
        -- An event with no read-model consequence is not an error: the log is
        -- the source of truth and may carry more than the projections need.
        NULL;

    END CASE;

    RETURN NEW;
END;
$$;

CREATE TRIGGER project_event_after_insert
    AFTER INSERT ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.project_event();
