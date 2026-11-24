const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config');

const OWNER_ID = '1105165947590938866';
const PER_PAGE = 20;

function buildPage(guild, page) {
    const emojis = [...guild.emojis.cache.values()];
    const totalPages = Math.max(1, Math.ceil(emojis.length / PER_PAGE));
    page = Math.max(0, Math.min(page, totalPages - 1));
    const slice = emojis.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

    const lines = slice.map(e => `${e} **${e.name}** — \`${e.id}\` — ${e.animated ? 'Animated' : 'Static'}`);
    const embed = new EmbedBuilder()
        .setTitle('Custom Emojis')
        .setColor(config.colors?.primary || 0x8B0000)
        .setDescription(lines.length ? lines.join('\n') : 'No custom emojis found.')
        .setFooter({ text: `Page ${page + 1}/${totalPages} • Total ${emojis.length}` })
        .setTimestamp();

    const row = new ActionRowBuilder();
    if (page > 0) {
        row.addComponents(new ButtonBuilder().setCustomId(`emojiid_prev_${page}`).setLabel('Previous').setStyle(ButtonStyle.Secondary));
    }
    if (page < totalPages - 1) {
        row.addComponents(new ButtonBuilder().setCustomId(`emojiid_next_${page}`).setLabel('Next').setStyle(ButtonStyle.Primary));
    }

    return { embeds: [embed], components: row.components.length ? [row] : [] };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emojiid')
        .setDescription('Show all custom emojis and their IDs'),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '<:crosss:1572295157200457819> You need Administrator permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const payload = buildPage(interaction.guild, 0);
            await interaction.editReply(payload);
        } catch (error) {
            console.error('EMOJIID ERROR:', error);
            await interaction.editReply({ content: '<:crosss:1572295157200457819> Failed to fetch emojis.' }).catch(() => {});
        }
    }
};

module.exports.buildPage = buildPage;