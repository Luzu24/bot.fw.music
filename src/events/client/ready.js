/**
 * Ready event handler triggered when the bot successfully logs in and connects to Discord.
 */

const { ActivityType } = require('discord.js');
const logger = require('../../utils/logger');
const config = require('../../../config.json');
const { pingJava } = require('../../utils/minecraft');

const ACTIVITY_REFRESH_INTERVAL = 60000;

module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        logger.info(`Logged in as ${client.user.tag}!`);

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const serverName = guild ? guild.name : 'Minecraft Server';
        let lastActivity = null;

        const updateActivity = async () => {
            try {
                const status = await pingJava();
                const statusText = status.online && status.players
                    ? `${status.players.online}/${status.players.max} giocatori`
                    : 'Offline';
                const activity = `${serverName} | ${config.minecraft.javaIp} | ${statusText}`;

                if (activity === lastActivity) return;
                lastActivity = activity;
                client.user.setActivity(activity, { type: ActivityType.Playing });
            } catch (error) {
                logger.error(`Failed to update bot activity: ${error.message}`);
            }
        };

        updateActivity();
        setInterval(updateActivity, ACTIVITY_REFRESH_INTERVAL);
    }
};
