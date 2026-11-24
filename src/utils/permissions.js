const roleConfig = require('./roleConfig');

async function load(member) {
    const guildId = member?.guild?.id || null;
    await roleConfig.loadConfigs(false, guildId);
    return guildId;
}

function debugAuth(commandName, requiredKey, requiredRoleId, member, allowed) {
    console.log('[AuthDebug]', commandName, {
        requiredKey,
        requiredRoleId,
        userRoleIds: member?.roles?.cache ? [...member.roles.cache.keys()] : [],
        allowed
    });
}

module.exports = {
    isTester: async (member) => {
        const guildId = await load(member);
        const keys = ['tester', 'verified_tester'];
        const allowed = keys.some(key => {
            const requiredRoleId = roleConfig.getRoleIdSync(key, guildId);
            return !!requiredRoleId && member.roles.cache.has(requiredRoleId);
        });
        if (!allowed) debugAuth('isTester', keys.join(','), keys.map(k => roleConfig.getRoleIdSync(k, guildId)), member, allowed);
        return allowed;
    },
    isBlacklisted: async (member) => {
        const guildId = await load(member);
        const requiredRoleId = roleConfig.getRoleIdSync('blacklist', guildId);
        const allowed = !!requiredRoleId && member.roles.cache.has(requiredRoleId);
        if (allowed) debugAuth('isBlacklisted', 'blacklist', requiredRoleId, member, allowed);
        return allowed;
    },
    isVerified: async (member) => {
        const guildId = await load(member);
        const keys = ['verified', 'registration', 'verified_tester'];
        const allowed = keys.some(key => {
            const requiredRoleId = roleConfig.getRoleIdSync(key, guildId);
            return !!requiredRoleId && member.roles.cache.has(requiredRoleId);
        });
        if (!allowed) debugAuth('isVerified', keys.join(','), keys.map(k => roleConfig.getRoleIdSync(k, guildId)), member, allowed);
        return allowed;
    },
    hasPriority: async (member) => {
        const guildId = await load(member);
        const keys = ['booster', 'vip', 'priority'];
        const allowed = keys.some(key => {
            const requiredRoleId = roleConfig.getRoleIdSync(key, guildId);
            return !!requiredRoleId && member.roles.cache.has(requiredRoleId);
        });
        if (!allowed) debugAuth('hasPriority', keys.join(','), keys.map(k => roleConfig.getRoleIdSync(k, guildId)), member, allowed);
        return allowed;
    }
};