/**
 * Main entry point for starting the Discord bot client.
 */

const path = require('path');
const dotenv = require('dotenv');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const result = dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (result.error) {
  console.error(result.error.message);
}

console.log('dotenv parsed keys:', result.parsed ? Object.keys(result.parsed) : 'none');
console.log('RCON_PASSWORD defined:', 'RCON_PASSWORD' in process.env, 'length:', (process.env.RCON_PASSWORD || '').length);

const logger = require('./utils/logger');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();

loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  logger.error(`Failed to log in to Discord: ${error.message}`);
});