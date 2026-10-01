/**
 * Ready event handler triggered when the bot successfully logs in and connects to Discord.
 */

const { ActivityType } = require('discord.js');
const logger = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        logger.info(`Logged in as ${client.user.tag}!`);

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const serverName = guild ? guild.name : 'Minecraft Server';

        client.user.setActivity(`${serverName} \vert{}${config.minecraft.javaIp}`, { type: ActivityType.Playing });
    }
};