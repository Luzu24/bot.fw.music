/**
 * Event handler triggered when a member leaves the Discord server.
 */

const logger = require('../../utils/logger');
const { sendRconCommand } = require('../../utils/rcon');
const { getWhitelistCommand } = require('../../utils/minecraft');
const { getWhitelistedData, removeWhitelistedUser } = require('../../utils/database');

module.exports = {
    name: 'guildMemberRemove',
    once: false,
    async execute(member, client) {
        const userData = getWhitelistedData()[member.id];
        if (!userData) return;

        const { username, platform } = userData;

        try {
            const rconResult = await sendRconCommand(client, getWhitelistCommand('remove', username, platform), null);

            if (!rconResult.success) {
                logger.error(`<@${member.id}> ha lasciato il server, ma non è stato possibile rimuovere \`${username}\` (${platform}) dalla whitelist: RCON non raggiungibile.`, client);
                return;
            }

            removeWhitelistedUser(member.id);
            logger.info(`<@${member.id}> ha lasciato il server: \`${username}\` (${platform}) rimosso dalla whitelist.`, client);
        } catch (error) {
            logger.error(`Error handling guildMemberRemove for ${member.id}: ${error.message}`, client);
        }
    }
};
