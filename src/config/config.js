
module.exports = {
    ownerId: '1434463040622952510',

    colors: {
        primary: 0x8B0000,
        secondary: 0x000000,
        success: 0x2ECC71,
        error: 0xE74C3C
    },

    // All supported gamemodes (NexTiers)
    gamemodes: [
        'Sword',
        'Axe',
        'Mace',
        'NethPot',
        'DiaPot',
        'SMP',
        'UHC',
        'Crystal'
    ],

    // Main channel configuration
    channels: {
        results: null,
        transcriptChannel: null,

        // Add the ticket category ID when available
        ticketCategory: null,

        testingCategory: null,

        // Waitlist channels are loaded dynamically from Supabase per guild.
        queues: {}
    },

    // Legacy waitlist roles (now loaded dynamically from Supabase)
    roles: {
        waitlist: {}
    },

    // Server setup configuration (loaded dynamically from Supabase)
    serverSetup: {
        waitlistChannels: {},
        resultsChannel: null,
        ticketLogsChannel: null,
        testingCategory: null,
        ticketCategory: null
    },

    // Display names
    gamemodeNames: {
        Sword: 'Sword',
        Axe: 'Axe',
        Mace: 'Mace',
        NethPot: 'NethPot',
        DiaPot: 'DiaPot',
        SMP: 'SMP',
        UHC: 'UHC',
        Crystal: 'Crystal'
    }
};