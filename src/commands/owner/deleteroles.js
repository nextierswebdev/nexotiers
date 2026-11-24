const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deleteroles')
        .setDescription('Delete all deletable roles in this server (owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.user.id !== '1105165947590938866') {
            return interaction.reply({
                content: '<:crosss:1572295157200457819> Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('deleteroles_confirm')
                .setLabel('Confirm Delete')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('deleteroles_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
            content: '⚠️ This will delete ALL deletable roles in this server. This action cannot be undone. Confirm?',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }
};