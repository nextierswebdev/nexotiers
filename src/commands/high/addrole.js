
const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const config = require('../../config/config');

const HIGH_TEST_CATEGORY_ID = '1538792400737148978';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Give a role access to this High Test ticket')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to give ticket access')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== config.ownerId) {
            return interaction.reply({
                content: '<:crosss:1572295157200457819> Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = interaction.channel;

        if (
            !channel ||
            channel.parentId !== HIGH_TEST_CATEGORY_ID ||
            !channel.topic?.includes('HT_USER:')
        ) {
            return interaction.reply({
                content: '<:crosss:1572295157200457819> Use this command inside a High Test ticket.',
                flags: MessageFlags.Ephemeral
            });
        }

        const role = interaction.options.getRole('role');

        if (role.id === interaction.guild.id) {
            return interaction.reply({
                content: '<:crosss:1572295157200457819> You cannot add @everyone to a ticket.',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await channel.permissionOverwrites.edit(role.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            });

            return interaction.reply({
                content: `<:tick:1572295109154701352> ${role} can now access this High Test ticket.`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('HIGH TEST ADDROLE ERROR:', error);

            return interaction.reply({
                content: '<:crosss:1572295157200457819> Failed to update ticket permissions. Check the bot permissions.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
