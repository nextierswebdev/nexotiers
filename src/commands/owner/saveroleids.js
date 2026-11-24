const { SlashCommandBuilder, MessageFlags, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config');
const tierSystem = require('../../utils/tierSystem');
const roleConfig = require('../../utils/roleConfig');

function roleColorHex(role) {
    if (!role || !role.color) return null;
    return '#' + role.color.toString(16).padStart(6, '0');
}

function findRole(guild, name) {
    return guild.roles.cache.find(r => r.name.toLowerCase() === String(name).toLowerCase()) || null;
}

function findCategory(guild, name) {
    return guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === String(name).toLowerCase()) || null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saveroleids')
        .setDescription('Save all setup role and category IDs to Supabase')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Admin only
        if (interaction.user.id !== '1105165947590938866') {
            return interaction.reply({
                content: '<:crosss:1572295157200457819> Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const guild = interaction.guild;
        const guildId = guild.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const saved = [];
        const failed = [];

        // Helper to upsert a role spec
        async function saveRole(key, name, category, gamemode, tier, role) {
            if (!role) {
                failed.push(`${key}: role not found (${name})`);
                return;
            }
            try {
                await roleConfig.upsertRoleConfig(
                    key,
                    role.name,
                    category,
                    gamemode || null,
                    tier || null,
                    roleColorHex(role),
                    role.id,
                    guildId
                );
                saved.push(key);
            } catch (error) {
                failed.push(`${key}: ${error?.message || error}`);
            }
        }

        // Tier roles
        for (const gamemode of (config.gamemodes || [])) {
            const display = config.gamemodeNames?.[gamemode] || gamemode;
            for (const tier of tierSystem.ACTIVE_TIERS) {
                const role = findRole(guild, `${display} ${tier}`);
                await saveRole(`tier_${gamemode}_${tier}`, `${display} ${tier}`, 'Tier', gamemode, tier, role);
            }
        }

        // General roles
        const generalRoles = [
            { key: 'sser', name: 'SSer', category: 'General' },
            { key: 'registered', name: 'Registered', category: 'General' },
            { key: 'priority', name: 'Priority (VIP)', category: 'General' },
            { key: 'admin', name: 'Admin', category: 'General' },
            { key: 'verified_tester', name: 'Verified Tester', category: 'General' },
            { key: 'manager', name: 'Manager', category: 'General' },
            { key: 'overseas', name: 'Overseas', category: 'General' },
            { key: 'sr_mod', name: 'Sr.Mod', category: 'General' },
            { key: 'mod', name: 'Mod', category: 'General' },
            { key: 'helper', name: 'Helper', category: 'General' },
            { key: 'trial_staff', name: 'Trial Staff', category: 'General' },
            { key: 'restricted', name: 'Restricted', category: 'General' },
            { key: 'waitlist', name: 'Waitlist Role', category: 'General' },
            { key: 'high_result_manager', name: 'High Result Manager', category: 'General' },
            { key: 'retire_result_manager', name: 'Retire Result Manager', category: 'General' },
            { key: 'staff', name: 'Staff', category: 'General' }
        ];

        for (const r of generalRoles) {
            const role = findRole(guild, r.name);
            await saveRole(r.key, r.name, r.category, null, null, role);
        }

        // Aliases for priority/vip/booster
        const priorityRole = findRole(guild, 'Priority (VIP)');
        if (priorityRole) {
            await saveRole('vip', 'Priority (VIP)', 'General', null, null, priorityRole);
            await saveRole('booster', 'Priority (VIP)', 'General', null, null, priorityRole);
        }

        // tester alias
        const verifiedTesterRole = findRole(guild, 'Verified Tester');
        if (verifiedTesterRole) {
            await saveRole('tester', 'Verified Tester', 'General', null, null, verifiedTesterRole);
        }

        // sr_mod alias
        const srModRole = findRole(guild, 'Sr.Mod');
        if (srModRole) {
            await saveRole('srmod', 'Sr.Mod', 'General', null, null, srModRole);
        }

        // Tester roles per gamemode
        for (const gamemode of (config.gamemodes || [])) {
            const display = config.gamemodeNames?.[gamemode] || gamemode;
            const role = findRole(guild, `${display} Tester`);
            await saveRole(`tester_gamemode_${gamemode}`, `${display} Tester`, 'Tester', gamemode, null, role);
        }

        // Waitlist roles per gamemode
        const waitlistRole = findRole(guild, 'Waitlist Role');
        for (const gamemode of (config.gamemodes || [])) {
            const display = config.gamemodeNames?.[gamemode] || gamemode;
            const specific = findRole(guild, `${display} Waitlist`);
            const roleToSave = specific || waitlistRole;
            await saveRole(`waitlist_${gamemode}`, roleToSave ? roleToSave.name : 'Waitlist Role', 'Waitlist', gamemode, null, roleToSave);
        }

        // Categories
        const categorySpecs = [
            { key: 'tickets', name: 'Tickets' },
            { key: 'high_tests', name: 'High Tests' },
            { key: 'transcripts', name: 'Transcripts' },
            { key: 'queues', name: 'Queues' }
        ];

        const savedCategories = [];
        const failedCategories = [];
        for (const spec of categorySpecs) {
            const category = findCategory(guild, spec.name);
            if (!category) {
                failedCategories.push(`${spec.key}: category not found (${spec.name})`);
                failed.push(`category:${spec.key}: not found`);
                continue;
            }
            try {
                await roleConfig.upsertCategoryConfig(spec.key, category.name, category.id, guildId);
                savedCategories.push(spec.key);
                saved.push(`category:${spec.key}`);
            } catch (error) {
                failedCategories.push(`${spec.key}: ${error?.message || error}`);
                failed.push(`category:${spec.key}: ${error?.message || error}`);
            }
        }

        // Verify reload
        await roleConfig.loadConfigs(true, guildId);
        const verifiedCategories = [];
        for (const spec of categorySpecs) {
            const id = roleConfig.getCategoryIdSync(spec.key, guildId);
            const cat = findCategory(guild, spec.name);
            if (id && cat && id === cat.id) verifiedCategories.push(spec.key);
        }

        await roleConfig.clearRoleConfigCache(guildId);

        const summary = [
            '✅ Save complete.',
            `Roles saved: ${saved.filter(s => !s.startsWith('category:')).length}`,
            `Categories saved: ${savedCategories.length}`,
            `Failed: ${failed.length}`
        ];
        if (failed.length > 0) {
            summary.push('', 'Failed items:', failed.slice(0, 25).join('\n'));
        }
        summary.push('', `Categories verified: ${verifiedCategories.length}/${categorySpecs.length}`);

        await interaction.editReply({ content: summary.join('\n') });
    }
};