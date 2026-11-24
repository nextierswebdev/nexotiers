const {
    SlashCommandBuilder
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const queueRenderer = require('../../queue/queueRenderer');
const perms = require('../../utils/permissions');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('waitlistclose')
        .setDescription('Closes the testing queue for this gamemode'),

    async execute(interaction) {

        // Tester check
        if (!await perms.isTester(interaction.member)) {

            return interaction.reply({
                content: '<:crosss:1572295157200457819> Only testers can use this command.',
                flags: 64
            });
        }

        // Find gamemode from current channel
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
                    '<:crosss:1572295157200457819> This channel is not a registered testing queue.',
                flags: 64
            });
        }

        // Acknowledge interaction
        await interaction.deferReply({
            flags: 64
        });

        try {

            // =============================================
            // RESOLVE QUEUE ROW
            // =============================================

            const { data: allQueues, error: fetchError } = await supabase
                .from('queues')
                .select('*');

            if (fetchError) {
                console.error('QUEUE FETCH ERROR:', fetchError);
                return interaction.editReply({
                    content:
                        '<:crosss:1572295157200457819> Failed to fetch queue configuration.'
                });
            }

            const guildQueues = (allQueues || []).filter(row =>
                !row.guild_id || String(row.guild_id) === String(interaction.guildId)
            );

            const queueRow = guildQueues.find(row =>
                String(row.channel_id) === String(interaction.channelId)
            ) || guildQueues.find(row =>
                String(row.gamemode || '').trim().toLowerCase() ===
                String(gamemode).trim().toLowerCase()
            );

            const dbGamemode = queueRow ? queueRow.gamemode : gamemode;

            // =============================================
            // CLOSE QUEUE
            // =============================================

            const { error: closeError } = await supabase
                .from('queues')
                .update({
                    status: 'CLOSED',
                    tester_id: null,
                    closed_at: new Date().toISOString()
                })
                .eq('channel_id', String(interaction.channelId));

            if (closeError) {

                console.error(
                    'QUEUE CLOSE DATABASE ERROR:',
                    closeError
                );

                return interaction.editReply({
                    content:
                        '<:crosss:1572295157200457819> Failed to close the queue.'
                });
            }

            // =============================================
            // CLEAR WAITING PLAYERS
            // =============================================

            const { error: deleteError } = await supabase
                .from('queue_members')
                .delete()
                .eq('guild_id', interaction.guildId)
                .in('gamemode', [gamemode, dbGamemode]);

            if (deleteError) {

                console.error(
                    'QUEUE MEMBERS CLEAR ERROR:',
                    deleteError
                );

                return interaction.editReply({
                    content:
                        '⚠️ Queue was closed, but the waiting players could not be removed from the queue.'
                });
            }

            // =============================================
            // UPDATE QUEUE PANEL
            // =============================================

            try {

                await queueRenderer.updateQueuePanel(
                    interaction.client,
                    gamemode
                );

            } catch (error) {

                console.error(
                    'QUEUE PANEL UPDATE ERROR:',
                    error
                );
            }

            // =============================================
            // SUCCESS
            // =============================================

            return interaction.editReply({
                content:
                    `<:close:1572294578873049229> **${gamemode}** queue has been closed.\n` +
                    `🗑️ All players were removed from the queue.`
            });

        } catch (error) {

            console.error(
                'WAITLIST CLOSE ERROR:',
                error
            );

            if (
                interaction.deferred ||
                interaction.replied
            ) {

                return interaction.editReply({
                    content:
                        '<:crosss:1572295157200457819> Something went wrong while closing the queue.'
                }).catch(() => {});

            }

            return interaction.reply({
                content:
                    '<:crosss:1572295157200457819> Something went wrong while closing the queue.',
                flags: 64
            }).catch(() => {});
        }
    }
};