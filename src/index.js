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

const logger = require('./utils/logger');