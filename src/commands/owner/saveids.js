const { SlashCommandBuilder, MessageFlags, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
const tierSystem = require('../../utils/tierSystem');
const roleConfig = require('../../utils/roleConfig');
const serverConfig = require('../../utils/serverConfig');
const emojiManager = require('../../utils/emojiManager');
const supabase = require('../../database/supabase');

const OWNER_IDS = ['1105165947590938866', config.ownerId].filter(Boolean);

const FINAL_GAMEMODES = ['Sword', 'Axe', 'Mace', 'NethPot', 'DiaPot', 'SMP', 'UHC', 'Crystal'];

function findRole(guild, name) {
    if (!name) return null;
    return guild.roles.cache.find(r => r.name.toLowerCase() === String(name).toLowerCase()) || null;
}

function findCategory(guild, name) {
    if (!name) return null;
    return guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === String(name).toLowerCase()) || null;
}

function findChannel(guild, name) {
    if (!name) return null;
    return guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === String(name).toLowerCase()) || null;
}

function hexFromColor(num) {
    if (num === null || num === undefined) return null;
    const n = Number(num);
    if (!Number.isFinite(n) || n <= 0) return null;
    return '#' + n.toString(16).padStart(6, '0');
}

function chunkList(items, maxLen, headerFactory) {
    const chunks = [];
    let current = '';
    for (const item of items) {
        const line = `- ${item}`;
        if (current && current.length + line.length + 1 > maxLen) {
            chunks.push(current);
            current = line;
        } else {
            current = current ? current + '\n' + line : line;
        }
    }
    if (current) chunks.push(current);
    const total = chunks.length || 1;
    return chunks.map((c, i) => `${headerFactory(i + 1, total)}\n${c}`);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saveids')
        .setDescription('Synchronize all existing Discord IDs into Supabase for this guild (owner only)')
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

        const failed = [];
        const missing = [];

        let rolesSaved = 0, rolesFailed = 0, rolesMissing = 0;
        let categoriesSaved = 0, categoriesFailed = 0, categoriesMissing = 0;
        let channelsSaved = 0, channelsFailed = 0, channelsMissing = 0;
        let gamemodesSaved = 0, gamemodesFailed = 0;
        let tiersSaved = 0, tiersFailed = 0, tiersMissing = 0;
        let parentSaved = false;

        // 1. Ensure parent server config row first.
        try {
            await serverConfig.upsertServerConfig(guildId, { guild_name: guild.name });
            parentSaved = true;
        } catch (e) {
            failed.push('server config parent: ' + (e?.message || e));
        }

        if (!parentSaved) {
            const embed = new EmbedBuilder()
                .setTitle('❌ /saveids failed')
                .setColor(0xE74C3C)
                .setDescription('Could not create the parent server configuration row. Child records were not saved.')
                .addFields({ name: 'Failures', value: String(failed.length) })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed], content: '' });
            if (failed.length > 0) {
                for (const chunk of chunkList(failed, 1700, (i, t) => `Failures (${i}/${t}):`)) {
                    await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral }).catch(() => {});
                }
            }
            return;
        }

        await interaction.editReply({ content: 'Saving role IDs...' });

        // 2. Roles
        const roleSpecs = [];
        roleSpecs.push({ key: 'owner', name: 'Tierlist Owner', category: 'Management' });
        const general = [
            { key: 'admin', name: 'Admin', category: 'Management' },
            { key: 'mod', name: 'Mod', category: 'Management' },
            { key: 'overseas', name: 'Overseas', category: 'Management' },
            { key: 'regulator', name: 'Regulator', category: 'Management' },
            { key: 'sr_mod', name: 'Sr.Mod', category: 'Management' },
            { key: 'helper', name: 'Helper', category: 'Management' },
            { key: 'staff', name: 'Staff Role', category: 'Management' },
            { key: 'verified_tester', name: 'Verified Tester', category: 'Special' },
            { key: 'restricted', name: 'Restricted Role', category: 'Special' },
            { key: 'priority', name: 'Priority Role', category: 'Special' },
            { key: 'registered', name: 'Registered Role', category: 'Special' }
        ];
        roleSpecs.push(...general);

        for (const gm of FINAL_GAMEMODES) {
            const display = config.gamemodeNames?.[gm] || gm;
            for (const tier of tierSystem.ACTIVE_TIERS) {
                roleSpecs.push({ key: `tier_${gm}_${tier}`, name: `${display} ${tier}`, category: 'Tier', gamemode: gm, tier });
            }
            roleSpecs.push({ key: `tier_${gm}_RHT1`, name: `${display} RHT1`, category: 'Tier', gamemode: gm, tier: 'RHT1' });
            roleSpecs.push({ key: `tester_gamemode_${gm}`, name: `${display} Tester`, category: 'Tester', gamemode: gm });
            roleSpecs.push({ key: `waitlist_${gm}`, name: `${display} Waitlist`, category: 'Waitlist', gamemode: gm });
        }

        for (const spec of roleSpecs) {
            const role = findRole(guild, spec.name);
            if (!role) {
                rolesMissing++;
                missing.push(`role: ${spec.name}`);
                continue;
            }
            try {
                const { error } = await supabase
                    .from('nextiers_role_configs')
                    .upsert({
                        guild_id: guildId,
                        role_key: spec.key,
                        role_name: role.name,
                        role_category: spec.category || null,
                        gamemode: spec.gamemode || null,
                        tier: spec.tier || null,
                        color: spec.color || hexFromColor(role.color),
                        role_id: role.id,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'guild_id,role_key' });
                if (error) throw error;
                rolesSaved++;
            } catch (e) {
                rolesFailed++;
                failed.push(`role ${spec.key}: ${e?.message || e}`);
            }
        }

        // Aliases (VIP/Booster/Priority, tester, srmod)
        const priorityRole = findRole(guild, 'Priority Role');
        if (priorityRole) {
            for (const alias of ['vip', 'booster', 'priority']) {
                try {
                    const { error } = await supabase
                        .from('nextiers_role_configs')
                        .upsert({
                            guild_id: guildId,
                            role_key: alias,
                            role_name: priorityRole.name,
                            role_category: 'Special',
                            gamemode: null,
                            tier: null,
                            color: hexFromColor(priorityRole.color),
                            role_id: priorityRole.id,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'guild_id,role_key' });
                    if (error) throw error;
                    rolesSaved++;
                } catch (e) {
                    rolesFailed++;
                    failed.push(`role ${alias}: ${e?.message || e}`);
                }
            }
        } else {
            rolesMissing++;
            missing.push('role: Priority Role (aliases)');
        }

        const verifiedTesterRole = findRole(guild, 'Verified Tester');
        if (verifiedTesterRole) {
            try {
                const { error } = await supabase
                    .from('nextiers_role_configs')
                    .upsert({
                        guild_id: guildId,
                        role_key: 'tester',
                        role_name: verifiedTesterRole.name,
                        role_category: 'Special',
                        gamemode: null,
                        tier: null,
                        color: hexFromColor(verifiedTesterRole.color),
                        role_id: verifiedTesterRole.id,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'guild_id,role_key' });
                if (error) throw error;
                rolesSaved++;
            } catch (e) {
                rolesFailed++;
                failed.push(`role tester: ${e?.message || e}`);
            }
        }

        const srModRole = findRole(guild, 'Sr.Mod');
        if (srModRole) {
            try {
                const { error } = await supabase
                    .from('nextiers_role_configs')
                    .upsert({
                        guild_id: guildId,
                        role_key: 'srmod',
                        role_name: srModRole.name,
                        role_category: 'Management',
                        gamemode: null,
                        tier: null,
                        color: hexFromColor(srModRole.color),
                        role_id: srModRole.id,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'guild_id,role_key' });
                if (error) throw error;
                rolesSaved++;
            } catch (e) {
                rolesFailed++;
                failed.push(`role srmod: ${e?.message || e}`);
            }
        }

        // 3. Categories
        await interaction.editReply({ content: 'Saving category IDs...' });
        const categorySpecs = [
            { key: 'main', name: 'NexTiers' },
            { key: 'waitlist', name: 'Waitlist' },
            { key: 'testing', name: 'Testing' },
            { key: 'high_tests', name: 'High Tests' },
            { key: 'transcripts', name: 'Transcripts' }
        ];

        for (const spec of categorySpecs) {
            const cat = findCategory(guild, spec.name);
            if (!cat) {
                categoriesMissing++;
                missing.push(`category: ${spec.name}`);
                continue;
            }
            try {
                const { error } = await supabase
                    .from('nextiers_category_configs')
                    .upsert({
                        guild_id: guildId,
                        category_key: spec.key,
                        category_name: cat.name,
                        category_id: cat.id,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'guild_id,category_key' });
                if (error) throw error;
                categoriesSaved++;
            } catch (e) {
                categoriesFailed++;
                failed.push(`category ${spec.key}: ${e?.message || e}`);
            }
        }

        // 4. Channels
        await interaction.editReply({ content: 'Saving channel IDs...' });
        const channelSpecs = [
            { key: 'tester_queue', name: 'tester-queue' },
            { key: 'testing_management', name: 'testing-management' },
            { key: 'high_test_panel', name: 'high-test-panel' },
            { key: 'high_test_queue', name: 'high-test-queue' },
            { key: 'high_test_management', name: 'high-test-management' },
            { key: 'results', name: 'results' },
            { key: 'ticket_logs', name: 'ticket-logs' },
            { key: 'transcripts', name: 'transcripts' },
            { key: 'staff_management', name: 'staff-management' },
            { key: 'tester_leaderboard', name: 'tester-leaderboard' },
            { key: 'registration_panel', name: 'registration-panel' },
            { key: 'waitlist_panel', name: 'waitlist-panel' }
        ];

        for (const gm of FINAL_GAMEMODES) {
            channelSpecs.push({ key: `waitlist_${gm}`, name: `${String(gm).toLowerCase()}-waitlist` });
        }

        for (const spec of channelSpecs) {
            const ch = findChannel(guild, spec.name);
            if (!ch) {
                channelsMissing++;
                missing.push(`channel: ${spec.name}`);
                continue;
            }
            try {
                const { error } = await supabase
                    .from('nextiers_channel_configs')
                    .upsert({
                        guild_id: guildId,
                        channel_key: spec.key,
                        channel_name: ch.name,
                        channel_id: ch.id,
                        channel_type: 'text',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'guild_id,channel_key' });
                if (error) throw error;
                channelsSaved++;
            } catch (e) {
                channelsFailed++;
                failed.push(`channel ${spec.key}: ${e?.message || e}`);
            }
        }

        // 5. Gamemodes
        await interaction.editReply({ content: 'Saving gamemode configuration...' });
        for (const gm of FINAL_GAMEMODES) {
            const display = config.gamemodeNames?.[gm] || gm;
            const waitlistRole = findRole(guild, `${display} Waitlist`);
            const payload = {
                guild_id: guildId,
                gamemode_name: gm,
                enabled: true,
                queue_settings: {},
                tier_config: {},
                updated_at: new Date().toISOString()
            };
            if (waitlistRole) payload.waitlist_role_id = waitlistRole.id;
            try {
                const { error } = await supabase
                    .from('nextiers_gamemodes')
                    .upsert(payload, { onConflict: 'guild_id,gamemode_name' });
                if (error) throw error;
                gamemodesSaved++;
            } catch (e) {
                gamemodesFailed++;
                failed.push(`gamemode ${gm}: ${e?.message || e}`);
            }
        }

        // 6. Tiers
        await interaction.editReply({ content: 'Saving tier configuration...' });
        let order = 0;
        for (const tier of [...tierSystem.ACTIVE_TIERS, 'RHT1']) {
            const points = tierSystem.getTierPoints(tier);
            for (const gm of FINAL_GAMEMODES) {
                const display = config.gamemodeNames?.[gm] || gm;
                const role = findRole(guild, `${display} ${tier}`);
                if (!role) {
                    tiersMissing++;
                    missing.push(`role: ${display} ${tier}`);
                    continue;
                }
                try {
                    const { error } = await supabase
                        .from('nextiers_tiers')
                        .upsert({
                            guild_id: guildId,
                            gamemode: gm,
                            tier_name: tier,
                            tier_role_id: role.id,
                            tier_points: points,
                            tier_order: order,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'guild_id,gamemode,tier_name' });
                    if (error) throw error;
                    tiersSaved++;
                } catch (e) {
                    tiersFailed++;
                    failed.push(`tier ${gm} ${tier}: ${e?.message || e}`);
                }
            }
            order++;
        }

        // 7. Emojis
        await interaction.editReply({ content: 'Collecting server emojis...' });
        let emojiResult = { saved: 0, failed: 0, total: 0 };
        try {
            emojiResult = await emojiManager.saveGuildEmojis(guild);
            if (emojiResult.failed > 0) {
                failed.push(`emoji collection: ${emojiResult.failed} failed`);
            }
        } catch (e) {
            failed.push('emoji collection: ' + (e?.message || e));
        }

        // Refresh caches
        roleConfig.clearRoleConfigCache(guildId);
        serverConfig.clearServerConfigCache(guildId);
        emojiManager.clearEmojiCache(guildId);

        const success = failed.length === 0 && missing.length === 0;
        const embed = new EmbedBuilder()
            .setTitle(success ? '✅ /saveids complete' : '⚠️ /saveids completed with issues')
            .setColor(success ? 0x2ECC71 : 0xE74C3C)
            .addFields(
                { name: 'Roles', value: `Saved: ${rolesSaved}\nFailed: ${rolesFailed}\nMissing: ${rolesMissing}`, inline: true },
                { name: 'Categories', value: `Saved: ${categoriesSaved}\nFailed: ${categoriesFailed}\nMissing: ${categoriesMissing}`, inline: true },
                { name: 'Channels', value: `Saved: ${channelsSaved}\nFailed: ${channelsFailed}\nMissing: ${channelsMissing}`, inline: true },
                { name: 'Gamemodes', value: `Saved: ${gamemodesSaved}/${FINAL_GAMEMODES.length}\nFailed: ${gamemodesFailed}`, inline: true },
                { name: 'Tiers', value: `Saved: ${tiersSaved}\nFailed: ${tiersFailed}\nMissing: ${tiersMissing}`, inline: true },
                { name: 'Emojis', value: `Saved: ${emojiResult.saved}/${emojiResult.total}\nFailed: ${emojiResult.failed}`, inline: true },
                { name: 'Totals', value: `Missing objects: ${missing.length}\nFailed operations: ${failed.length}`, inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], content: '' });

        if (missing.length > 0) {
            for (const chunk of chunkList(missing, 1700, (i, t) => `Missing (${i}/${t}):`)) {
                await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
        if (failed.length > 0) {
            for (const chunk of chunkList(failed, 1700, (i, t) => `Failures (${i}/${t}):`)) {
                await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};