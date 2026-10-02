/**
 * Utility module for custom formatted console logging with timestamps.
 */

const config = require('../../config.json');
const { createEmbed } = require('./embedBuilder');

const sendToLogChannel = async (client, type, message) => {
    const channelId = config.channels?.botLogs;
    if (!client || !channelId) return;

    try {
        const logChannel = await client.channels.fetch(channelId);
        if (logChannel) {
            const embed = createEmbed({
                type: type === 'error' ? 'error' : 'info',
                title: type === 'error' ? 'Errore Bot' : 'Log di Sistema',
                description: message
            });
            await logChannel.send({ embeds: [embed] });
        }
    } catch { }
};

const info = (message, client = null) => {
    console.log(`[INFO] ${message}`);
    if (client) sendToLogChannel(client, 'info', message);
};

const warn = (message, client = null) => {
    console.warn(`[WARN] ${message}`);
    if (client) sendToLogChannel(client, 'warn', message);
};

const error = (message, client = null) => {
    console.error(`[ERROR] ${message}`);
    if (client) sendToLogChannel(client, 'error', message);
};

module.exports = { info, warn, error };