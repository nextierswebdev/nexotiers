const {
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const queueRenderer = require('../../queue/queueRenderer');
const perms = require('../../utils/permissions');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('waitlistopen')
        .setDescription('Opens the testing queue for the current gamemode'),

    async execute(interaction) {

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {

            // -----------------------------------------
            // TESTER CHECK
            // -----------------------------------------

            if (!await perms.isTester(interaction.member)) {
                return interaction.editReply({
                    content: '<:crosss:1572295157200457819> Only testers can use this command.'
                });
            }

            // -----------------------------------------
            // FIND GAMEMODE
            // -----------------------------------------

            const configGamemode =
                config.channels.queues?.[interaction.channelId];

            let gamemode = configGamemode;

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
                return interaction.editReply({
                    content:
                        '<:crosss:1572295157200457819> This channel is not a registered queue channel.'
                });
            }

            // -----------------------------------------
            // RESOLVE QUEUE ROW (ROBUST TO DB VALUE)
            // -----------------------------------------

            const { data: allQueues, error: fetchError } = await supabase
                .from('queues')
                .select('*');

            if (fetchError) {
                console.error('Queue fetch error:', fetchError);
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

            if (!queueRow) {
                console.error(
                    `[${gamemode}] NO QUEUE ROW FOUND IN SUPABASE.`,
                    'Available:',
                    (allQueues || []).map(row => JSON.stringify(row.gamemode))
                );
                return interaction.editReply({
                    content:
                        '<:crosss:1572295157200457819> No queue row found for this gamemode.'
                });
            }

            const dbGamemode = queueRow.gamemode;

            // -----------------------------------------
            // OPEN QUEUE
            // -----------------------------------------

            const { data: updatedRows, error } = await supabase
                .from('queues')
                .update({
                    status: 'OPEN',
                    tester_id: interaction.user.id,
                    opened_at: new Date().toISOString()
                })
                .eq('channel_id', String(interaction.channelId))
                .select('gamemode');

            if (error) {
                console.error(
                    'Queue open database error:',
                    error
                );

                return interaction.editReply({
                    content:
                        '<:crosss:1572295157200457819> Failed to open the queue in the database.'
                });
            }

            if (!updatedRows || updatedRows.length === 0) {
                console.error(
                    `[${gamemode}] Queue update affected 0 rows.`
                );
                return interaction.editReply({
                    content:
                        '<:crosss:1572295157200457819> Failed to open the queue in the database.'
                });
            }

            // -----------------------------------------
            // UPDATE PANEL
            // -----------------------------------------

try {
    const panelUpdated = await queueRenderer.updateQueuePanel(
        interaction.client,
        gamemode
    );

    if (!panelUpdated) {
        throw new Error('Queue panel was not created or updated.');
    }
} catch (error) {
    console.error('QUEUE PANEL UPDATE ERROR:', error);

    return interaction.editReply({
        content:
'<:crosss:1572295157200457819> Queue was opened, but the queue panel could not be created or updated: ' + (error?.message || error)
    });
}

            // -----------------------------------------
            // @HERE PING
            // -----------------------------------------

            const pingMessage = await interaction.channel.send({
                content: '@here',
                allowedMentions: {
                    parse: ['everyone']
                }
            });

            // Delete ping message after 1 second
            setTimeout(async () => {
                await pingMessage.delete().catch(() => {});
            }, 1000);

            // -----------------------------------------
            // SUCCESS
            // -----------------------------------------

            await interaction.editReply({
                content:
                    `🟢 **${gamemode}** testing queue is now OPEN.`
            });

        } catch (error) {

            console.error(
                'WAITLIST OPEN ERROR:',
                error
            );

            if (interaction.deferred) {
                await interaction.editReply({
                    content:
                        '<:crosss:1572295157200457819> Something went wrong while opening the queue.'
                }).catch(() => {});
            }
        }
    }
};