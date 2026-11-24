const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const setupFull = require('../../utils/setupFull');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updateroleid')
        .setDescription('Sync Discord role IDs to Supabase')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.user.id !== '1105165947590938866') {
            return interaction.reply({ content: '<:crosss:1572295157200457819> Only the bot owner can use this command.', flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            await setupFull.runUpdateroleid(interaction);
        } catch (error) {
            console.error('UPDATEROLEID ERROR:', error);
            await interaction.editReply({ content: '<:crosss:1572295157200457819> Failed to sync role IDs.' }).catch(() => {});
        }
    }
};