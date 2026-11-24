const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const setupFull = require('../../utils/setupFull');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupfull')
        .setDescription('Complete NexTiers server setup')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.user.id !== '1105165947590938866') {
            return interaction.reply({ content: '<:crosss:1572295157200457819> Only the bot owner can use this command.', flags: MessageFlags.Ephemeral });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setupfull_confirm').setLabel('Confirm Setup').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('setupfull_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
            content: 'This will create the complete NexTiers setup for this server. Continue?',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }
};