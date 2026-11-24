const supabase = require('../database/supabase');

const cache = new Map();

async function loadServerConfig(guildId, force = false) {
    if (!guildId) return null;
    const key = String(guildId);
    const now = Date.now();
    const cached = cache.get(key);
    if (!force && cached && (now - cached.loadedAt) < 60000) return cached.data;

    const { data, error } = await supabase
        .from('nextiers_server_configs')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

    if (error) throw error;
    cache.set(key, { data: data || null, loadedAt: now });
    return data || null;
}

function getWaitlistChannelsSync(guildId) {
    const cached = cache.get(String(guildId));
    return cached?.data?.waitlist_channels || null;
}

async function getWaitlistChannels(guildId, force = false) {
    const data = await loadServerConfig(guildId, force);
    return data?.waitlist_channels || null;
}

async function getResultsChannel(guildId, force = false) {
    const data = await loadServerConfig(guildId, force);
    return data?.results_channel || null;
}

async function getTicketLogsChannel(guildId, force = false) {
    const data = await loadServerConfig(guildId, force);
    return data?.ticket_logs_channel || null;
}

async function getTestingCategory(guildId, force = false) {
    const data = await loadServerConfig(guildId, force);
    return data?.testing_category || null;
}

async function getHighTestCategory(guildId, force = false) {
    const data = await loadServerConfig(guildId, force);
    return data?.high_test_category || data?.config?.high_test_category || null;
}

async function getWaitlistCategory(guildId, force = false) {
    const data = await loadServerConfig(guildId, force);
    return data?.waitlist_category || data?.config?.waitlist_category || null;
}

async function upsertServerConfig(guildId, payload) {
    const p = payload || {};
    const row = {
        guild_id: guildId,
        waitlist_channels: p.waitlist_channels || {},
        results_channel: p.results_channel || null,
        ticket_logs_channel: p.ticket_logs_channel || null,
        testing_category: p.testing_category || null,
        high_test_category: p.high_test_category || null,
        waitlist_category: p.waitlist_category || null,
        transcripts_category: p.transcripts_category || null,
        main_category: p.main_category || null,
        config: p.config || {},
        updated_at: new Date().toISOString()
    };
    if (p.guild_name) row.guild_name = p.guild_name;
    if (p.setup_status) row.setup_status = p.setup_status;
    if (p.setup_completed_at) row.setup_completed_at = p.setup_completed_at;
    const { error } = await supabase
        .from('nextiers_server_configs')
        .upsert(row, { onConflict: 'guild_id' });
    if (error) throw error;
    cache.delete(String(guildId));
}

function clearServerConfigCache(guildId = null) {
    if (guildId) cache.delete(String(guildId));
    else cache.clear();
}

module.exports = {
    loadServerConfig,
    getWaitlistChannels,
    getWaitlistChannelsSync,
    getResultsChannel,
    getTicketLogsChannel,
    getTestingCategory,
    getHighTestCategory,
    getWaitlistCategory,
    upsertServerConfig,
    clearServerConfigCache
};