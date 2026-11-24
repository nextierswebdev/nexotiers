-- NexTiers /setupall missing-column migration.
-- Idempotent: safe to run on existing databases. Does not rename or delete columns/data.
-- Fixes: "Could not find the 'high_test_category' column of 'nextiers_server_configs' in the schema cache"
-- and ensures every column used by setupall.js / serverConfig.js exists.

-- ============================================================
-- nextiers_server_configs (all columns used by setupall/serverConfig)
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
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS waitlist_channels jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS results_channel text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS ticket_logs_channel text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS testing_category text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS high_test_category text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS waitlist_category text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS transcripts_category text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS main_category text;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.nextiers_server_configs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- nextiers_role_configs (used by roleConfig.js / setupall)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_role_configs (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL,
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

ALTER TABLE public.nextiers_role_configs ADD COLUMN IF NOT EXISTS role_name text;
ALTER TABLE public.nextiers_role_configs ADD COLUMN IF NOT EXISTS role_category text;
ALTER TABLE public.nextiers_role_configs ADD COLUMN IF NOT EXISTS gamemode text;
ALTER TABLE public.nextiers_role_configs ADD COLUMN IF NOT EXISTS tier text;
ALTER TABLE public.nextiers_role_configs ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.nextiers_role_configs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- nextiers_category_configs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_category_configs (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL,
    category_key text NOT NULL,
    category_name text,
    category_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guild_id, category_key)
);

ALTER TABLE public.nextiers_category_configs ADD COLUMN IF NOT EXISTS category_name text;
ALTER TABLE public.nextiers_category_configs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- nextiers_gamemodes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_gamemodes (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL,
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

ALTER TABLE public.nextiers_gamemodes ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.nextiers_gamemodes ADD COLUMN IF NOT EXISTS queue_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.nextiers_gamemodes ADD COLUMN IF NOT EXISTS tier_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.nextiers_gamemodes ADD COLUMN IF NOT EXISTS waitlist_role_id text;
ALTER TABLE public.nextiers_gamemodes ADD COLUMN IF NOT EXISTS gamemode_emoji_id text;
ALTER TABLE public.nextiers_gamemodes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- nextiers_tiers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_tiers (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL,
    tier_name text NOT NULL,
    tier_role_id text,
    tier_points integer NOT NULL DEFAULT 0,
    tier_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guild_id, tier_name)
);

ALTER TABLE public.nextiers_tiers ADD COLUMN IF NOT EXISTS tier_role_id text;
ALTER TABLE public.nextiers_tiers ADD COLUMN IF NOT EXISTS tier_points integer NOT NULL DEFAULT 0;
ALTER TABLE public.nextiers_tiers ADD COLUMN IF NOT EXISTS tier_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.nextiers_tiers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- nextiers_emojis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nextiers_emojis (
    id bigserial PRIMARY KEY,
    guild_id text NOT NULL,
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

ALTER TABLE public.nextiers_emojis ADD COLUMN IF NOT EXISTS animated boolean NOT NULL DEFAULT false;
ALTER TABLE public.nextiers_emojis ADD COLUMN IF NOT EXISTS mention text;
ALTER TABLE public.nextiers_emojis ADD COLUMN IF NOT EXISTS gamemode text;
ALTER TABLE public.nextiers_emojis ADD COLUMN IF NOT EXISTS feature text;
ALTER TABLE public.nextiers_emojis ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Refresh PostgREST schema cache (Supabase)
NOTIFY pgrst, 'reload schema';