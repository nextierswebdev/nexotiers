-- Server-level configuration and guild scoping for queues/queue_members.

ALTER TABLE public.queues
    ADD COLUMN IF NOT EXISTS guild_id text;

ALTER TABLE public.queue_members
    ADD COLUMN IF NOT EXISTS guild_id text;

CREATE TABLE IF NOT EXISTS public.nextiers_server_configs (
    guild_id text PRIMARY KEY,
    waitlist_channels jsonb NOT NULL DEFAULT '{}'::jsonb,
    results_channel text,
    ticket_logs_channel text,
    testing_category text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS queues_guild_id_idx
    ON public.queues (guild_id);

CREATE INDEX IF NOT EXISTS queue_members_guild_id_idx
    ON public.queue_members (guild_id);