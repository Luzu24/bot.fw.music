/**
 * Main entry point for starting the Discord bot client.
 */

const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();

const logger = require('./utils/logger');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  logger.error('Failed to log in to Discord:', error);
});