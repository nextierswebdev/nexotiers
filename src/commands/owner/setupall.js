const { SlashCommandBuilder, MessageFlags, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config');
const tierSystem = require('../../utils/tierSystem');
const roleConfig = require('../../utils/roleConfig');
const serverConfig = require('../../utils/serverConfig');
const emojiManager = require('../../utils/emojiManager');
const supabase = require('../../database/supabase');

const OWNER_IDS = ['1105165947590938866', config.ownerId].filter(Boolean);

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function hexToInt(hex) { return parseInt(String(hex).replace('#', ''), 16); }

const FINAL_GAMEMODES = ['Sword', 'Axe', 'Mace', 'NethPot', 'DiaPot', 'SMP', 'UHC', 'Crystal'];

async function findOrCreateRole(guild, name, color) {
    const existing = guild.roles.cache.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (existing) return { role: existing, created: false };
    try {
        const role = await guild.roles.create({ name, color: hexToInt(color), reason: 'NexTiers /setupall' });
        await sleep(250);
        return { role, created: true };
    } catch (e) {
        return { role: null, created: false, error: e };
    }
}

async function findOrCreateCategory(guild, name) {
    const existing = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, reason: 'NexTiers /setupall' });
    await sleep(250);
    return cat;
}

async function findOrCreateTextChannel(guild, name, parent) {
    const existing = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        if (parent && existing.parentId !== parent.id) await existing.setParent(parent).catch(() => {});
        return existing;
    }
    const ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent, reason: 'NexTiers /setupall' });
    await sleep(250);
    return ch;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupall')
        .setDescription('Automatically set up the entire NexTiers server (owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!OWNER_IDS.includes(interaction.user.id)) {
            return interaction.reply({
                content: '<:crosss:1572295157200457819> Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const guild = interaction.guild;
        const guildId = guild.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Permission checks
        const botMember = guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles) || !botMember?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.editReply({ content: '<:crosss:1572295157200457819> Bot missing Manage Roles / Manage Channels permissions.' });
        }

        const created = [];
        const reused = [];
        const failed = [];

        // Ensure server config row
        try {
            await serverConfig.upsertServerConfig(guildId, { guild_name: guild.name, setup_status: 'in_progress' });
        } catch (e) {
            failed.push('server config init: ' + (e?.message || e));
        }

        // ---- ROLES ----
        await interaction.editReply({ content: 'Setting up roles...' });

        const roleSpecs = [];
        // Tierlist Owner
        roleSpecs.push({ key: 'owner', name: 'Tierlist Owner', color: '#F1C40F', category: 'Management' });
        const general = [
            { key: 'admin', name: 'Admin', color: '#E74C3C', category: 'Management' },
            { key: 'mod', name: 'Mod', color: '#F39C12', category: 'Management' },
            { key: 'overseas', name: 'Overseas', color: '#1ABC9C', category: 'Management' },
            { key: 'regulator', name: 'Regulator', color: '#9B59B6', category: 'Management' },
            { key: 'sr_mod', name: 'Sr.Mod', color: '#E67E22', category: 'Management' },
            { key: 'helper', name: 'Helper', color: '#27AE60', category: 'Management' },
            { key: 'staff', name: 'Staff Role', color: '#2C3E50', category: 'Management' },
            { key: 'verified_tester', name: 'Verified Tester', color: '#2ECC71', category: 'Special' },
            { key: 'restricted', name: 'Restricted Role', color: '#7F8C8D', category: 'Special' },
            { key: 'priority', name: 'Priority Role', color: '#9B59B6', category: 'Special' },
            { key: 'registered', name: 'Registered Role', color: '#95A5A6', category: 'Special' }
        ];
        roleSpecs.push(...general);

        // aliases
        // Tier roles
        for (const gm of FINAL_GAMEMODES) {
            const display = config.gamemodeNames?.[gm] || gm;
            for (const tier of tierSystem.ACTIVE_TIERS) {
                roleSpecs.push({ key: `tier_${gm}_${tier}`, name: `${display} ${tier}`, color: tierSystem.getTierColor(tier) || '#95A5A6', category: 'Tier', gamemode: gm, tier });
            }
            // RHT1
            roleSpecs.push({ key: `tier_${gm}_RHT1`, name: `${display} RHT1`, color: tierSystem.getTierColor('HT1') || '#C0392B', category: 'Tier', gamemode: gm, tier: 'RHT1' });
        }
        // Tester roles
        for (const gm of FINAL_GAMEMODES) {
            const display = config.gamemodeNames?.[gm] || gm;
            roleSpecs.push({ key: `tester_gamemode_${gm}`, name: `${display} Tester`, color: '#5865F2', category: 'Tester', gamemode: gm });
        }
        // Waitlist roles
        for (const gm of FINAL_GAMEMODES) {
            const display = config.gamemodeNames?.[gm] || gm;
            roleSpecs.push({ key: `waitlist_${gm}`, name: `${display} Waitlist`, color: '#5865F2', category: 'Waitlist', gamemode: gm });
        }

        const roleMap = new Map();
        let processed = 0;
        for (const spec of roleSpecs) {
            const { role, created: wasCreated, error } = await findOrCreateRole(guild, spec.name, spec.color);
            if (error) { failed.push(`${spec.key || spec.name}: ${error?.message || error}`); }
            else {
                if (wasCreated) created.push(spec.name); else reused.push(spec.name);
                if (spec.key && role) {
                    roleMap.set(spec.key, role);
                    try {
                        await roleConfig.upsertRoleConfig(spec.key, role.name, spec.category, spec.gamemode || null, spec.tier || null, spec.color, role.id, guildId);
                    } catch (e) { failed.push(`save ${spec.key}: ${e?.message || e}`); }
                }
            }
            processed++;
            if (processed % 15 === 0) await interaction.editReply({ content: `Setting up roles... ${processed}/${roleSpecs.length}` }).catch(() => {});
        }

        // aliases
        const priorityRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'priority role');
        if (priorityRole) {
            for (const alias of ['vip', 'booster', 'priority']) {
                try { await roleConfig.upsertRoleConfig(alias, priorityRole.name, 'Special', null, null, '#' + priorityRole.color.toString(16).padStart(6, '0'), priorityRole.id, guildId); } catch (e) {}
            }
        }
        const verifiedTesterRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'verified tester');
        if (verifiedTesterRole) {
            try { await roleConfig.upsertRoleConfig('tester', verifiedTesterRole.name, 'Special', null, null, '#' + verifiedTesterRole.color.toString(16).padStart(6, '0'), verifiedTesterRole.id, guildId); } catch (e) {}
        }
        const srModRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'sr.mod');
        if (srModRole) {
            try { await roleConfig.upsertRoleConfig('srmod', srModRole.name, 'Management', null, null, '#' + srModRole.color.toString(16).padStart(6, '0'), srModRole.id, guildId); } catch (e) {}
        }

        // ---- CATEGORIES ----
        await interaction.editReply({ content: 'Setting up categories...' });

        const categorySpecs = [
            { key: 'waitlist', name: 'Waitlist' },
            { key: 'testing', name: 'Testing' },
            { key: 'high_tests', name: 'High Tests' },
            { key: 'transcripts', name: 'Transcripts' },
            { key: 'main', name: 'NexTiers' }
        ];

        const categoryMap = new Map();
        for (const spec of categorySpecs) {
            const cat = await findOrCreateCategory(guild, spec.name);
            categoryMap.set(spec.key, cat);
            try { await roleConfig.upsertCategoryConfig(spec.key, cat.name, cat.id, guildId); } catch (e) { failed.push(`category ${spec.key}: ${e?.message || e}`); }
            if (cat) { created.push(`category:${spec.key}`); }
        }

        const waitlistCat = categoryMap.get('waitlist');
        const testingCat = categoryMap.get('testing');
        const highTestsCat = categoryMap.get('high_tests');
        const transcriptsCat = categoryMap.get('transcripts');
        const mainCat = categoryMap.get('main');

        // ---- CHANNELS ----
        await interaction.editReply({ content: 'Setting up channels...' });

        // Waitlist channels per gamemode
        const waitlistChannels = {}; // channelId -> gamemode
        for (const gm of FINAL_GAMEMODES) {
            const chName = `${String(gm).toLowerCase()}-waitlist`;
            const ch = await findOrCreateTextChannel(guild, chName, waitlistCat);
            if (ch) {
                waitlistChannels[ch.id] = gm;
                reused.push(`channel:${chName}`);
            }
        }

        // Testing category channels
        const testerQueueCh = await findOrCreateTextChannel(guild, 'tester-queue', testingCat);
        const testingMgmtCh = await findOrCreateTextChannel(guild, 'testing-management', testingCat);
        // High Test category channels
        const highTestPanelCh = await findOrCreateTextChannel(guild, 'high-test-panel', highTestsCat);
        const highTestQueueCh = await findOrCreateTextChannel(guild, 'high-test-queue', highTestsCat);
        const highTestMgmtCh = await findOrCreateTextChannel(guild, 'high-test-management', highTestsCat);
        // Main channels
        const resultsCh = await findOrCreateTextChannel(guild, 'results', mainCat);
        const ticketLogsCh = await findOrCreateTextChannel(guild, 'ticket-logs', mainCat);
        const transcriptsCh = await findOrCreateTextChannel(guild, 'transcripts', transcriptsCat);
        const staffMgmtCh = await findOrCreateTextChannel(guild, 'staff-management', mainCat);
        const testerLbCh = await findOrCreateTextChannel(guild, 'tester-leaderboard', mainCat);
        const registrationPanelCh = await findOrCreateTextChannel(guild, 'registration-panel', mainCat);
        const waitlistPanelCh = await findOrCreateTextChannel(guild, 'waitlist-panel', mainCat);

        // ---- SUPABASE: gamemodes table ----
        await interaction.editReply({ content: 'Saving gamemode configuration...' });
        for (const gm of FINAL_GAMEMODES) {
            const waitlistRoleId = roleMap.get(`waitlist_${gm}`)?.id || null;
            const emojiRow = null;
            try {
                await supabase.from('nextiers_gamemodes').upsert({
                    guild_id: guildId,
                    gamemode_name: gm,
                    enabled: true,
                    queue_settings: {},
                    tier_config: {},
                    waitlist_role_id: waitlistRoleId,
                    gamemode_emoji_id: emojiRow,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'guild_id,gamemode_name' });
            } catch (e) {
                failed.push(`gamemode ${gm}: ${e?.message || e}`);
            }
        }

        // ---- SUPABASE: tiers table ----
        await interaction.editReply({ content: 'Saving tier configuration...' });
        let order = 0;
        for (const tier of [...tierSystem.ACTIVE_TIERS, 'RHT1']) {
            const points = tierSystem.getTierPoints(tier);
            for (const gm of FINAL_GAMEMODES) {
                const roleId = roleMap.get(`tier_${gm}_${tier}`)?.id || null;
                try {
                    await supabase.from('nextiers_tiers').upsert({
                        guild_id: guildId,
                        tier_name: tier,
                        tier_role_id: roleId,
                        tier_points: points,
                        tier_order: order,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'guild_id,tier_name' });
                } catch (e) {
                    // may fail due to unique on guild+tier_name only one row per tier; that's fine
                }
            }
            order++;
        }

        // ---- SUPABASE: server config ----
        try {
            await serverConfig.upsertServerConfig(guildId, {
                guild_name: guild.name,
                setup_status: 'completed',
                setup_completed_at: new Date().toISOString(),
                waitlist_channels: waitlistChannels,
                results_channel: resultsCh?.id || null,
                ticket_logs_channel: ticketLogsCh?.id || null,
                testing_category: testingCat?.id || null,
                high_test_category: highTestsCat?.id || null,
                waitlist_category: waitlistCat?.id || null,
                transcripts_category: transcriptsCat?.id || null,
                main_category: mainCat?.id || null,
                config: {
                    tester_queue_channel: testerQueueCh?.id || null,
                    testing_management_channel: testingMgmtCh?.id || null,
                    high_test_panel_channel: highTestPanelCh?.id || null,
                    high_test_queue_channel: highTestQueueCh?.id || null,
                    high_test_management_channel: highTestMgmtCh?.id || null,
                    transcripts_channel: transcriptsCh?.id || null,
                    staff_management_channel: staffMgmtCh?.id || null,
                    tester_leaderboard_channel: testerLbCh?.id || null,
                    registration_panel_channel: registrationPanelCh?.id || null,
                    waitlist_panel_channel: waitlistPanelCh?.id || null
                }
            });
        } catch (e) {
            failed.push('server config save: ' + (e?.message || e));
        }

        // ---- EMOJIS ----
        await interaction.editReply({ content: 'Collecting server emojis...' });
        let emojiResult = { saved: 0, failed: 0, total: 0 };
        try {
            emojiResult = await emojiManager.saveGuildEmojis(guild);
        } catch (e) {
            failed.push('emoji collection: ' + (e?.message || e));
        }

        // Refresh caches
        roleConfig.clearRoleConfigCache(guildId);
        serverConfig.clearServerConfigCache(guildId);
        emojiManager.clearEmojiCache(guildId);

        // Finalize setup status if no failures? mark completed regardless but report.
        if (failed.length > 0) {
            try { await serverConfig.upsertServerConfig(guildId, { setup_status: 'incomplete' }); } catch (e) {}
        }

        const summary = [
            '✅ NexTiers /setupall complete.',
            `Roles created: ${created.filter(x => !x.startsWith('category:') && !x.startsWith('channel:')).length}`,
            `Roles reused: ${reused.filter(x => !x.startsWith('category:') && !x.startsWith('channel:')).length}`,
            `Categories/channels created: ${created.filter(x => x.startsWith('category:')).length}`,
            `Emojis saved: ${emojiResult.saved}/${emojiResult.total}`,
            `Failures: ${failed.length}`
        ];
        if (failed.length > 0) summary.push('', 'Failures:', failed.slice(0, 30).join('\n'));

        await interaction.editReply({ content: summary.join('\n') });
    }
};