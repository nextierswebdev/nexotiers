-- Fix queue channel IDs for the new server.
-- Guild ID: 1568906912068665346

UPDATE public.queues
SET channel_id = '1572306600025137313',
    guild_id = '1568906912068665346'
WHERE gamemode = 'Crystal';

UPDATE public.queues
SET channel_id = '1572306598582554679',
    guild_id = '1568906912068665346'
WHERE gamemode = 'Nethpot';

UPDATE public.queues
SET channel_id = '1572306604936798339',
    guild_id = '1568906912068665346'
WHERE gamemode = 'Mace';

UPDATE public.queues
SET channel_id = '1572306606618574871',
    guild_id = '1568906912068665346'
WHERE gamemode = 'SMP';

-- Ensure any missing queue rows exist for these gamemodes.
INSERT INTO public.queues (guild_id, gamemode, channel_id, status)
SELECT '1568906912068665346', v.gamemode, v.channel_id, 'CLOSED'
FROM (VALUES
    ('Crystal', '1572306600025137313'),
    ('Nethpot', '1572306598582554679'),
    ('Mace', '1572306604936798339'),
    ('SMP', '1572306606618574871')
) AS v(gamemode, channel_id)
WHERE NOT EXISTS (
    SELECT 1 FROM public.queues q WHERE q.gamemode = v.gamemode
);