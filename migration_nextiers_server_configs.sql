-- Server-level configuration and guild scoping for queues/queue_members.

ALTER TABLE public.queues
    ADD COLUMN IF NOT EXISTS guild_id text;

ALTER TABLE public.queue_members
    ADD COLUMN IF NOT EXISTS guild_id text;

CREATE TABLE IF NOT EXISTS public.nextiers_server_configs (
    guild_id text PRIMARY KEY,
    guild_name text,
    setup_status text NOT NULL DEFAULT 'pending',
    setup_completed_at timestamptz,
    waitlist_channels jsonb NOT NULL DEFAULT '{}'::jsonb,
    results_channel text,
    ticket_logs_channel text,
    testing_category text,
    high_test_category text,
    waitlist_category text,
    transcripts_category text,
    main_category text,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS guild_name text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS setup_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS high_test_category text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS waitlist_category text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS transcripts_category text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS main_category text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS queues_guild_id_idx
    ON public.queues (guild_id);

CREATE INDEX IF NOT EXISTS queue_members_guild_id_idx
    ON public.queue_members (guild_id);

NOTIFY pgrst, 'reload schema';