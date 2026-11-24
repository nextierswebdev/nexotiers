const {
    Client,
    GatewayIntentBits,
    Collection,
    Partials
} = require('discord.js');

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const express = require('express');

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel
    ]
});

client.commands = new Collection();

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.status(200).send('NexTiers Bot is online!');
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        bot: client.isReady() ? 'connected' : 'connecting',
        uptime: process.uptime()
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('Web server running on port ' + PORT);
});

const commandsPath = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs
        .readdirSync(folderPath)
        .filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log('Loaded Command: ' + command.data.name);
        }
    }
}

const eventsPath = path.join(__dirname, 'src/events');
const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }

    console.log('Loaded Event: ' + event.name);
}

const roleConfig = require('./src/utils/roleConfig');

client.once('clientReady', async () => {
    console.log('Discord client ready');
    for (const guild of client.guilds.cache.values()) {
        try {
            await roleConfig.loadConfigs(false, guild.id);
            console.log('Role/category configuration loaded for guild ' + guild.id);
        } catch (error) {
            console.error('Failed to load role/category configuration for guild ' + guild.id, error && error.message ? error.message : error);
        }
    }
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

(async () => {
    try {
        await client.login(process.env.TOKEN);
        console.log('NexTiers Bot Logged In');
    } catch (error) {
        console.error('Discord Login Failed:', error);
        process.exit(1);
    }
})();
