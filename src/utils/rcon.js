/**
 * Utility module for sending RCON commands to the Minecraft server and logging their results.
 */

const { Rcon } = require('rcon-client');
const config = require('../../config.json');
const { createEmbed } = require('./embedBuilder');
const logger = require('./logger');
const { truncateText } = require('./formatters');

const MAX_LOGGED_RESPONSE_LENGTH = 1000;

const REJECTION_PATTERNS = [
    /does not exist/i,
    /unknown or incomplete command/i,
    /incorrect argument/i,
    /no player was found/i,
    /could not find/i,
    /not found/i
];

const isCommandRejected = (response) => REJECTION_PATTERNS.some(pattern => pattern.test(response || ''));

const sendRconCommand = async (client, command, executor) => {
    let rcon;
    let response = '';
    let success = false;

    try {
        rcon = await Rcon.connect({
            host: config.rcon?.host || '85.155.151.71',
            port: parseInt(config.rcon?.port || 25575, 10),
            password: process.env.RCON_PASSWORD
        });

        response = await rcon.send(command);
        await rcon.end();
        success = true;
    } catch (error) {
        if (rcon) {
            try {
                await rcon.end();
            } catch { }
        }
        response = error.message || 'Errore di connessione RCON';
        logger.error(`RCON Execution Error: ${error.message}`, client);
    }

    const channelId = config.channels?.rconLogs;
    if (client && channelId) {
        try {
            const logChannel = await client.channels.fetch(channelId);
            if (logChannel) {
                const embed = createEmbed({
                    type: success ? 'info' : 'error',
                    title: 'Log Esecuzione RCON',
                    fields: [
                        { name: 'Comando Eseguito', value: `\`\`\`${command}\`\`\``, inline: false },
                        { name: 'Esecutore', value: executor ? `${executor}` : 'Sistema', inline: true },
                        { name: 'Esito', value: success ? 'Riuscito' : 'Fallito', inline: true },
                        { name: 'Risposta Console', value: `\`\`\`${truncateText((response || 'Nessuna risposta').replace(/```/g, "'''"), MAX_LOGGED_RESPONSE_LENGTH)}\`\`\``, inline: false }
                    ]
                });
                await logChannel.send({ embeds: [embed] });
            }
        } catch (logError) {
            logger.error(`RCON Logging Error: ${logError.message}`, client);
        }
    }

    return { success, response };
};

module.exports = { sendRconCommand, isCommandRejected };