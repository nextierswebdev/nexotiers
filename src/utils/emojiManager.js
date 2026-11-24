// Centralized custom-emoji manager for NexTiers.
// Loads emoji metadata from Supabase (nextiers_emojis) per guild.
// Falls back to the static config/emojis.js map only when DB has no entry,
// and always logs missing emojis instead of using Unicode fallbacks.
const supabase = require('../database/supabase');
const staticEmojis = require('../config/emojis');

const CACHE_TTL = 60 * 1000;
const cache = new Map(); // guildId -> { emojis: {name: mention}, loadedAt }

function cacheKey(guildId) { return guildId ? String(guildId) : null; }

async function loadEmojis(guildId, force = false) {
    const key = cacheKey(guildId);
    if (!key) return { emojis: {}, loadedAt: Date.now() };
    const now = Date.now();
    const existing = cache.get(key);
    if (!force && existing && (now - existing.loadedAt) < CACHE_TTL) return existing;

    let data = null;
    let error = null;
    try {
        const result = await supabase
            .from('nextiers_emojis')
            .select('emoji_name, emoji_id, animated, mention, gamemode, feature')
            .eq('guild_id', guildId);
        data = result.data;
        error = result.error;
    } catch (e) { error = e; }

    if (error) {
        console.error('[EmojiManager] Supabase emoji load error:', error);
        // Do not silently fall back; return empty and log.
        const entry = { emojis: {}, loadedAt: now };
        cache.set(key, entry);
        return entry;
    }

    const emojis = {};
    for (const row of data || []) {
        if (row?.emoji_name && row?.emoji_id) {
            const mention = row.mention || `<${row.animated ? 'a' : ''}:${row.emoji_name}:${row.emoji_id}>`;
            emojis[row.emoji_name] = mention;
            // also store by lower-case for lookups
            emojis[String(row.emoji_name).toLowerCase()] = mention;
        }
    }

    const entry = { emojis, loadedAt: now };
    cache.set(key, entry);
    console.log('[EmojiManager] Loaded', Object.keys(emojis).length, 'emojis for guild', guildId);
    return entry;
}

function getEmojiSync(guildId, name) {
    if (!name) return null;
    const entry = cache.get(cacheKey(guildId));
    if (entry?.emojis?.[name]) return entry.emojis[name];
    if (entry?.emojis?.[String(name).toLowerCase()]) return entry.emojis[String(name).toLowerCase()];
    // Static fallback (logged)
    if (staticEmojis.gamemodes?.[name]) {
        console.warn('[EmojiManager] Using static fallback for emoji:', name);
        return staticEmojis.gamemodes[name];
    }
    if (staticEmojis.ui?.[name]) {
        console.warn('[EmojiManager] Using static fallback for emoji:', name);
        return staticEmojis.ui[name];
    }
    console.warn('[EmojiManager] Missing emoji, no fallback:', name);
    return null;
}

async function getEmoji(guildId, name, force = false) {
    await loadEmojis(guildId, force);
    return getEmojiSync(guildId, name);
}

function textFallback(name) {
    return `[${name}]`;
}

async function collectGuildEmojis(guild) {
    if (!guild) return [];
    const list = [];
    for (const emoji of guild.emojis.cache.values()) {
        list.push({
            guild_id: guild.id,
            emoji_name: emoji.name,
            emoji_id: emoji.id,
            animated: emoji.animated || false,
            mention: emoji.toString(),
            gamemode: null,
            feature: null
        });
    }
    return list;
}

async function saveGuildEmojis(guild) {
    if (!guild) return { saved: 0, failed: 0 };
    const rows = await collectGuildEmojis(guild);
    let saved = 0, failed = 0;
    for (const row of rows) {
        try {
            const { error } = await supabase
                .from('nextiers_emojis')
                .upsert(row, { onConflict: 'guild_id,emoji_name' });
            if (error) throw error;
            saved++;
        } catch (e) {
            failed++;
            console.error('[EmojiManager] Failed to save emoji', row.emoji_name, e?.message || e);
        }
    }
    clearEmojiCache(guild.id);
    return { saved, failed, total: rows.length };
}

function clearEmojiCache(guildId = null) {
    if (guildId) cache.delete(cacheKey(guildId));
    else cache.clear();
}

module.exports = {
    loadEmojis,
    getEmoji,
    getEmojiSync,
    textFallback,
    collectGuildEmojis,
    saveGuildEmojis,
    clearEmojiCache
};