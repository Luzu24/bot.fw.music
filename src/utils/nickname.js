/**
 * Utility module for syncing Discord nicknames with Minecraft usernames.
 */

const { RESTJSONErrorCodes } = require('discord.js');

const MAX_NICKNAME_LENGTH = 32;

const toNickname = (username) => username.slice(0, MAX_NICKNAME_LENGTH);

const syncNickname = async (member, username, reason) => {
    const nickname = toNickname(username);
    if (member.nickname === nickname) return 'unchanged';

    try {
        if (!member.manageable) return 'forbidden';
        await member.setNickname(nickname, reason);
        return 'updated';
    } catch (error) {
        return error.code === RESTJSONErrorCodes.MissingPermissions ? 'forbidden' : 'failed';
    }
};

const describeNicknameResult = (result, username) => {
    if (result === 'updated' || result === 'unchanged') return `\`${toNickname(username)}\``;
    if (result === 'forbidden') return 'Non aggiornato: permessi insufficienti';
    return 'Non aggiornato: errore';
};

module.exports = { syncNickname, describeNicknameResult };
