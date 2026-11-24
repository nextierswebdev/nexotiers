const {
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');

const config = require('../../config/config');
const queueRenderer = require('../../queue/queueRenderer');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Refresh the queue panel in this channel'),

    async execute(interaction) {

        // -----------------------------------------
        // FIND GAMEMODE FROM CURRENT CHANNEL
        // -----------------------------------------

        let gamemode =
            config.channels.queues?.[interaction.channelId];

        if (!gamemode) {
            try {
                const serverConfig = require('../../utils/serverConfig');
                const channels = await serverConfig.getWaitlistChannels(interaction.guildId);
                if (channels) {
                    for (const [channelId, gm] of Object.entries(channels)) {
                        if (String(channelId) === String(interaction.channelId)) {
                            gamemode = gm;
                            break;
                        }
                    }
                }
            } catch (e) {
                console.error('SERVER CONFIG LOAD ERROR:', e);
            }
        }

        if (!gamemode) {
            return interaction.reply({
                content:
                    '<:crosss:1572295157200457819> This channel is not a NexTiers queue channel.',
                flags: MessageFlags.Ephemeral
            });
        }

        // -----------------------------------------
        // UPDATE QUEUE PANEL
        // -----------------------------------------

        try {

            await queueRenderer.updateQueuePanel(
                interaction.client,
                gamemode
            );

            await interaction.reply({
                content:
                    `🔄 **${gamemode}** queue panel has been refreshed.`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {

            console.error(
                `REFRESH ERROR (${gamemode}):`,
                error
            );

            if (!interaction.replied && !interaction.deferred) {

                await interaction.reply({
                    content:
                        '<:crosss:1572295157200457819> Failed to refresh the queue panel.',
                    flags: MessageFlags.Ephemeral
                });

            }
        }
    }
};