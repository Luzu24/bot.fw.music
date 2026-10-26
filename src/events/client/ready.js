/**
 * Ready event handler triggered when the bot successfully logs in and connects to Discord.
 */

const { ActivityType } = require('discord.js');
const logger = require('../../utils/logger');
const config = require('../../../config.json');
const { pingJava, pingBedrock } = require('../../utils/minecraft');

const ACTIVITY_REFRESH_INTERVAL = 60000;

module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        logger.info(`Logged in as ${client.user.tag}!`);

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const serverName = guild ? guild.name : 'Minecraft Server';
        let lastActivity = null;
        const serverStates = { Java: null, Bedrock: null };

        const logServerState = (name, status) => {
            const state = status.online ? 'online' : status.error;
            if (serverStates[name] === state) return;
            serverStates[name] = state;

            if (status.online) {
                logger.info(`${name} server is reachable at ${status.target}.`);
            } else if (status.error === 'NOT_CONFIGURED') {
                logger.info(`${name} server address is not configured: status checks are skipped.`);
            } else {
                logger.warn(`${name} server is unreachable at ${status.target}: ${status.error}.`);
            }
        };

        const updateActivity = async () => {
            try {
                const [status, bedrockStatus] = await Promise.all([pingJava(), pingBedrock()]);
                logServerState('Java', status);
                logServerState('Bedrock', bedrockStatus);
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
