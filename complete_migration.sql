-- NexTiers complete Supabase migration (multi-guild).
-- Safe to run on an existing database: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Does NOT delete historical data.

-- ============================================================
-- Helper: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Server configuration (one row per guild)
-- ============================================================
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

DROP TRIGGER IF EXISTS nextiers_server_configs_updated_at ON public.nextiers_server_configs;
CREATE TRIGGER nextiers_server_configs_updated_at
    BEFORE UPDATE ON public.nextiers_server_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate legacy table if present (best-effort, idempotent).
INSERT INTO public.nextiers_server_configs (guild_id, waitlist_channels, results_channel, ticket_logs_channel, testing_category, updated_at)
SELECT guild_id, waitlist_channels, results_channel, ticket_logs_channel, testing_category, COALESCE(updated_at, now())
FROM public.asian_server_configs
WHERE guild_id IS NOT NULL
ON CONFLICT (guild_id) DO NOTHING;

-- ============================================================
-- Role configuration (per guild)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_role_configs (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL REFERENCES public.nextiers_server_configs(guild_id) ON DELETE CASCADE,
    role_key text NOT NULL,
    role_name text,
    role_category text,
    gamemode text,
    tier text,
    color text,
    role_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guild_id, role_key)
);

CREATE INDEX IF NOT EXISTS nextiers_role_configs_guild_id_idx ON public.nextiers_role_configs (guild_id);
CREATE INDEX IF NOT EXISTS nextiers_role_configs_role_id_idx ON public.nextiers_role_configs (role_id);

DROP TRIGGER IF EXISTS nextiers_role_configs_updated_at ON public.nextiers_role_configs;
CREATE TRIGGER nextiers_role_configs_updated_at
    BEFORE UPDATE ON public.nextiers_role_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate legacy kairo_role_configs if present.
INSERT INTO public.nextiers_role_configs (guild_id, role_key, role_name, role_category, gamemode, tier, color, role_id, updated_at)
SELECT guild_id, role_key, role_name, role_category, gamemode, tier, color, role_id, COALESCE(updated_at, now())
FROM public.kairo_role_configs
WHERE guild_id IS NOT NULL
ON CONFLICT (guild_id, role_key) DO NOTHING;

-- ============================================================
-- Category configuration (per guild)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_category_configs (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL REFERENCES public.nextiers_server_configs(guild_id) ON DELETE CASCADE,
    category_key text NOT NULL,
    category_name text,
    category_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guild_id, category_key)
);

CREATE INDEX IF NOT EXISTS nextiers_category_configs_guild_id_idx ON public.nextiers_category_configs (guild_id);

DROP TRIGGER IF EXISTS nextiers_category_configs_updated_at ON public.nextiers_category_configs;
CREATE TRIGGER nextiers_category_configs_updated_at
    BEFORE UPDATE ON public.nextiers_category_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate legacy kairo_category_configs if present.
INSERT INTO public.nextiers_category_configs (guild_id, category_key, category_name, category_id, updated_at)
SELECT guild_id, category_key, category_name, category_id, COALESCE(updated_at, now())
FROM public.kairo_category_configs
WHERE guild_id IS NOT NULL
ON CONFLICT (guild_id, category_key) DO NOTHING;

-- ============================================================
-- Gamemodes (per guild)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_gamemodes (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL REFERENCES public.nextiers_server_configs(guild_id) ON DELETE CASCADE,
    gamemode_name text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    queue_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    tier_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    waitlist_role_id text,
    gamemode_emoji_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guild_id, gamemode_name)
);

CREATE INDEX IF NOT EXISTS nextiers_gamemodes_guild_id_idx ON public.nextiers_gamemodes (guild_id);

DROP TRIGGER IF EXISTS nextiers_gamemodes_updated_at ON public.nextiers_gamemodes;
CREATE TRIGGER nextiers_gamemodes_updated_at
    BEFORE UPDATE ON public.nextiers_gamemodes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Tiers (per guild)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_tiers (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL REFERENCES public.nextiers_server_configs(guild_id) ON DELETE CASCADE,
    tier_name text NOT NULL,
    tier_role_id text,
    tier_points integer NOT NULL DEFAULT 0,
    tier_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guild_id, tier_name)
);

CREATE INDEX IF NOT EXISTS nextiers_tiers_guild_id_idx ON public.nextiers_tiers (guild_id);

DROP TRIGGER IF EXISTS nextiers_tiers_updated_at ON public.nextiers_tiers;
CREATE TRIGGER nextiers_tiers_updated_at
    BEFORE UPDATE ON public.nextiers_tiers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Emojis (per guild)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_emojis (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL REFERENCES public.nextiers_server_configs(guild_id) ON DELETE CASCADE,
    emoji_name text NOT NULL,
    emoji_id text NOT NULL,
    animated boolean NOT NULL DEFAULT false,
    mention text,
    gamemode text,
    feature text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guild_id, emoji_name)
);

CREATE INDEX IF NOT EXISTS nextiers_emojis_guild_id_idx ON public.nextiers_emojis (guild_id);

DROP TRIGGER IF EXISTS nextiers_emojis_updated_at ON public.nextiers_emojis;
CREATE TRIGGER nextiers_emojis_updated_at
    BEFORE UPDATE ON public.nextiers_emojis
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Players (global, historical data preserved)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.players (
    discord_id text PRIMARY KEY,
    ign text,
    region text,
    account_type text,
    peak_tiers jsonb NOT NULL DEFAULT '{}'::jsonb,
    retired_tiers jsonb NOT NULL DEFAULT '{}'::jsonb,
    retired_points_by_gamemode jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS peak_tiers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS retired_tiers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS retired_points_by_gamemode jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP TRIGGER IF EXISTS players_updated_at ON public.players;
CREATE TRIGGER players_updated_at
    BEFORE UPDATE ON public.players
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Queues (per guild)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.queues (
    id bigserial PRIMARY KEY,
    guild_id text,
    gamemode text NOT NULL,
    channel_id text,
    panel_message_id text,
    status text NOT NULL DEFAULT 'CLOSED',
    tester_id text,
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS guild_id text;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS panel_message_id text;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS tester_id text;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS queues_guild_id_idx ON public.queues (guild_id);
CREATE INDEX IF NOT EXISTS queues_gamemode_idx ON public.queues (gamemode);

DROP TRIGGER IF EXISTS queues_updated_at ON public.queues;
CREATE TRIGGER queues_updated_at
    BEFORE UPDATE ON public.queues
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Queue members (per guild)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.queue_members (
    id bigserial PRIMARY KEY,
    guild_id text,
    discord_id text NOT NULL,
    gamemode text NOT NULL,
    priority boolean NOT NULL DEFAULT false,
    joined_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.queue_members ADD COLUMN IF NOT EXISTS guild_id text;
ALTER TABLE public.queue_members ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS queue_members_guild_id_idx ON public.queue_members (guild_id);
CREATE INDEX IF NOT EXISTS queue_members_discord_id_idx ON public.queue_members (discord_id);

DROP TRIGGER IF EXISTS queue_members_updated_at ON public.queue_members;
CREATE TRIGGER queue_members_updated_at
    BEFORE UPDATE ON public.queue_members
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Results (historical preserved)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.results (
    id bigserial PRIMARY KEY,
    guild_id text,
    discord_id text NOT NULL,
    gamemode text,
    old_tier text,
    new_tier text,
    tester_id text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.results ADD COLUMN IF NOT EXISTS guild_id text;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS old_tier text;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS tester_id text;

CREATE INDEX IF NOT EXISTS results_guild_id_idx ON public.results (guild_id);
CREATE INDEX IF NOT EXISTS results_discord_id_idx ON public.results (discord_id);

-- ============================================================
-- Testing cooldowns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.testing_cooldowns (
    discord_id text NOT NULL,
    gamemode text NOT NULL,
    cooldown_until timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (discord_id, gamemode)
);

DROP TRIGGER IF EXISTS testing_cooldowns_updated_at ON public.testing_cooldowns;
CREATE TRIGGER testing_cooldowns_updated_at
    BEFORE UPDATE ON public.testing_cooldowns
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- High test allowlist
-- ============================================================
CREATE TABLE IF NOT EXISTS public.high_test_players (
    id bigserial PRIMARY KEY,
    guild_id text,
    discord_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guild_id, discord_id)
);

ALTER TABLE public.high_test_players ADD COLUMN IF NOT EXISTS guild_id text;

-- ============================================================
-- High test staff roles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.high_test_staff_roles (
    id bigserial PRIMARY KEY,
    guild_id text,
    role_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guild_id, role_id)
);

ALTER TABLE public.high_test_staff_roles ADD COLUMN IF NOT EXISTS guild_id text;

-- ============================================================
-- Optional RPC: refresh server config cache is client-side.
-- Provide a helper to fetch full guild config in one call.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_guild_config(p_guild_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'server', (SELECT to_jsonb(s) FROM public.nextiers_server_configs s WHERE s.guild_id = p_guild_id),
        'roles', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.nextiers_role_configs r WHERE r.guild_id = p_guild_id),
        'categories', (SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) FROM public.nextiers_category_configs c WHERE c.guild_id = p_guild_id),
        'gamemodes', (SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb) FROM public.nextiers_gamemodes g WHERE g.guild_id = p_guild_id),
        'tiers', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.nextiers_tiers t WHERE t.guild_id = p_guild_id),
        'emojis', (SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb) FROM public.nextiers_emojis e WHERE e.guild_id = p_guild_id)
    ) INTO result;
    RETURN result;
END;
$$;