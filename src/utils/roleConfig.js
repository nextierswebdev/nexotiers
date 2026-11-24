// Centralized role/category configuration loaded from Supabase.
// Multi-guild aware: every lookup is scoped by guild_id.
const supabase = require('../database/supabase');

const CACHE_TTL = 60 * 1000;
const cache = new Map(); // guildId -> { roles: {}, categories: {}, loadedAt }

function cacheKey(guildId) {
    return guildId ? String(guildId) : null;
}

function getEntry(guildId) {
    const key = cacheKey(guildId);
    if (!key) return null;
    return cache.get(key) || null;
}

async function loadConfigs(force = false, guildId = null) {
    const key = cacheKey(guildId);
    if (!key) {
        return { roles: {}, categories: {}, loadedAt: Date.now() };
    }

    const now = Date.now();
    const existing = cache.get(key);
    if (!force && existing && (now - existing.loadedAt) < CACHE_TTL) {
        return existing;
    }

    // Role configs
    let roleData = null;
    let roleError = null;
    try {
        const result = await supabase
            .from('nextiers_role_configs')
            .select('role_key, role_name, role_category, gamemode, tier, color, role_id')
            .eq('guild_id', guildId);
        roleData = result.data;
        roleError = result.error;
    } catch (e) {
        roleError = e;
    }

    if (roleError) {
        console.error('[RoleConfig] Supabase role load error:', roleError);
        throw roleError;
    }

    // Category configs
    let categoryData = null;
    let categoryError = null;
    try {
        const result = await supabase
            .from('nextiers_category_configs')
            .select('category_key, category_name, category_id')
            .eq('guild_id', guildId);
        categoryData = result.data;
        categoryError = result.error;
    } catch (e) {
        categoryError = e;
    }

    if (categoryError) {
        console.error('[RoleConfig] Supabase category load error:', categoryError);
        throw categoryError;
    }

    const roles = {};
    for (const row of roleData || []) {
        if (row?.role_key && row?.role_id) {
            roles[row.role_key] = String(row.role_id);
        }
    }

    const categories = {};
    for (const row of categoryData || []) {
        if (row?.category_key && row?.category_id) {
            categories[row.category_key] = String(row.category_id);
        }
    }

    const entry = { roles, categories, loadedAt: now };
    cache.set(key, entry);
    console.log('[RoleConfig] Loaded', Object.keys(roles).length, 'roles and', Object.keys(categories).length, 'categories for guild', guildId);
    return entry;
}

async function loadRoleConfigs(force = false, guildId = null) {
    return loadConfigs(force, guildId);
}

async function loadCategoryConfigs(force = false, guildId = null) {
    return loadConfigs(force, guildId);
}

function getRoleConfigsSync(guildId = null) {
    const entry = getEntry(guildId);
    return entry ? { ...entry.roles } : {};
}

function getCategoryConfigsSync(guildId = null) {
    const entry = getEntry(guildId);
    return entry ? { ...entry.categories } : {};
}

function getRoleIdSync(roleKey, guildId = null) {
    if (!roleKey) return null;
    const entry = getEntry(guildId);
    return entry?.roles?.[roleKey] ? String(entry.roles[roleKey]) : null;
}

function getCategoryIdSync(categoryKey, guildId = null) {
    if (!categoryKey) return null;
    const entry = getEntry(guildId);
    return entry?.categories?.[categoryKey] ? String(entry.categories[categoryKey]) : null;
}

async function getRoleId(roleKey, guildId = null, force = false) {
    await loadConfigs(force, guildId);
    return getRoleIdSync(roleKey, guildId);
}

async function getCategoryId(categoryKey, guildId = null, force = false) {
    await loadConfigs(force, guildId);
    return getCategoryIdSync(categoryKey, guildId);
}

function getTierRoleIdsSync(gamemode, guildId = null) {
    const entry = getEntry(guildId);
    if (!entry) return [];
    const prefix = `tier_${gamemode}_`;
    const result = [];
    for (const [key, id] of Object.entries(entry.roles || {})) {
        if (key.startsWith(prefix)) result.push(id);
    }
    return result;
}

function getGamemodeTesterRoleIdSync(gamemode, guildId = null) {
    return getRoleIdSync(`tester_gamemode_${gamemode}`, guildId);
}

async function getTierRoleIds(gamemode, guildId = null, force = false) {
    await loadConfigs(force, guildId);
    return getTierRoleIdsSync(gamemode, guildId);
}

async function getGamemodeTesterRoleId(gamemode, guildId = null, force = false) {
    await loadConfigs(force, guildId);
    return getGamemodeTesterRoleIdSync(gamemode, guildId);
}

function hasRoleSync(member, roleKey, guildId = null) {
    const roleId = getRoleIdSync(roleKey, guildId);
    if (!roleId || !member?.roles?.cache) return false;
    return member.roles.cache.has(roleId);
}

async function hasRole(member, roleKey, guildId = null, force = false) {
    const gid = guildId || member?.guild?.id || null;
    await loadConfigs(force, gid);
    return hasRoleSync(member, roleKey, gid);
}

async function upsertRoleConfig(roleKey, roleName, roleCategory, gamemode, tier, color, roleId, guildId) {
    if (!guildId) throw new Error('guildId is required to upsert role config');
    const { error } = await supabase
        .from('nextiers_role_configs')
        .upsert({
            guild_id: guildId,
            role_key: roleKey,
            role_name: roleName,
            role_category: roleCategory || null,
            gamemode: gamemode || null,
            tier: tier || null,
            color: color || null,
            role_id: roleId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'guild_id,role_key' });

    if (error) throw error;
    cache.delete(String(guildId));
}

async function upsertCategoryConfig(categoryKey, categoryName, categoryId, guildId) {
    if (!guildId) throw new Error('guildId is required to upsert category config');
    const { error } = await supabase
        .from('nextiers_category_configs')
        .upsert({
            guild_id: guildId,
            category_key: categoryKey,
            category_name: categoryName,
            category_id: categoryId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'guild_id,category_key' });

    if (error) throw error;
    cache.delete(String(guildId));
}

function clearRoleConfigCache(guildId = null) {
    if (guildId) {
        cache.delete(String(guildId));
    } else {
        cache.clear();
    }
}

function clearCategoryConfigCache(guildId = null) {
    clearRoleConfigCache(guildId);
}

module.exports = {
    loadConfigs,
    loadRoleConfigs,
    loadCategoryConfigs,
    getRoleConfigsSync,
    getCategoryConfigsSync,
    getRoleIdSync,
    getCategoryIdSync,
    getRoleId,
    getCategoryId,
    getTierRoleIdsSync,
    getTierRoleIds,
    getGamemodeTesterRoleIdSync,
    getGamemodeTesterRoleId,
    hasRoleSync,
    hasRole,
    upsertRoleConfig,
    upsertCategoryConfig,
    clearRoleConfigCache,
    clearCategoryConfigCache
};