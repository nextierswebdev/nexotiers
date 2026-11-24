const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config');
const tierSystem = require('../../utils/tierSystem');
const roleConfig = require('../../utils/roleConfig');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function hexToInt(hex) {
    return parseInt(String(hex).replace('#', ''), 16);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupremgamemodes')
        .setDescription('Create Nethpot/Crystal roles and retired tier roles for all gamemodes')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.user.id !== '1105165947590938866') {
            return interaction.reply({
                content: '<:crosss:1572295157200457819> Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const guild = interaction.guild;
        const guildId = guild.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const created = [];
        const reused = [];
        const failed = [];

        async function findOrCreateRole(name, color) {
            const existing = guild.roles.cache.find(r => r.name.toLowerCase() === name.toLowerCase());
            if (existing) {
                reused.push(name);
                return existing;
            }
            try {
                const role = await guild.roles.create({
                    name,
                    color: hexToInt(color),
                    reason: 'NexTiers /setupremgamemodes'
                });
                created.push(name);
                await sleep(250);
                return role;
            } catch (error) {
                failed.push(`${name}: ${error?.message || error}`);
                return null;
            }
        }

        // Waitlist roles
        await findOrCreateRole('Nethpot Waitlist', '#5865F2');
        await findOrCreateRole('Crystal Waitlist', '#5865F2');

        // Tester roles
        await findOrCreateRole('Nethpot Tester', '#5865F2');
        await findOrCreateRole('Crystal Tester', '#5865F2');

        // Active tier roles for Nethpot and Crystal
        for (const gamemode of ['Nethpot', 'Crystal']) {
            const display = gamemode;
            for (const tier of tierSystem.ACTIVE_TIERS) {
                await findOrCreateRole(`${display} ${tier}`, tierSystem.getTierColor(tier));
            }
        }

        // Retired tier roles for ALL gamemodes
        const retiredTiers = Object.values(tierSystem.RETIRED_TIER_MAP);
        for (const gamemode of (config.gamemodes || [])) {
            const display = config.gamemodeNames?.[gamemode] || gamemode;
            for (const retiredTier of retiredTiers) {
                const baseTier = retiredTier.replace(/^R/, '');
                await findOrCreateRole(`${display} ${retiredTier}`, tierSystem.getTierColor(baseTier));
            }
        }

        // Save Nethpot/Crystal role IDs that have known keys
        await roleConfig.loadConfigs(false, guildId);
        const savePairs = [];
        // waitlist roles
        for (const gm of ['Nethpot', 'Crystal']) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === `${gm} Waitlist`.toLowerCase());
            if (role) savePairs.push([`waitlist_${gm}`, `${gm} Waitlist`, 'Waitlist', gm, null, role]);
        }
        // tester roles
        for (const gm of ['Nethpot', 'Crystal']) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === `${gm} Tester`.toLowerCase());
            if (role) savePairs.push([`tester_gamemode_${gm}`, `${gm} Tester`, 'Tester', gm, null, role]);
        }
        // tier roles
        for (const gm of ['Nethpot', 'Crystal']) {
            for (const tier of tierSystem.ACTIVE_TIERS) {
                const role = guild.roles.cache.find(r => r.name.toLowerCase() === `${gm} ${tier}`.toLowerCase());
                if (role) savePairs.push([`tier_${gm}_${tier}`, `${gm} ${tier}`, 'Tier', gm, tier, role]);
            }
        }

        for (const [key, name, category, gm, tier, role] of savePairs) {
            try {
                await roleConfig.upsertRoleConfig(
                    key,
                    role.name,
                    category,
                    gm,
                    tier,
                    '#' + role.color.toString(16).padStart(6, '0'),
                    role.id,
                    guildId
                );
            } catch (error) {
                failed.push(`${key}: ${error?.message || error}`);
            }
        }

        await roleConfig.clearRoleConfigCache(guildId);

        const summary = [
            '✅ setupremgamemodes complete.',
            `Created: ${created.length}`,
            `Reused: ${reused.length}`,
            `Failed: ${failed.length}`
        ];
        if (failed.length > 0) {
            summary.push('', 'Failed items:', failed.slice(0, 20).join('\n'));
        }

        await interaction.editReply({ content: summary.join('\n') });
    }
};