/**
 * Utility module for reading and writing the whitelist and blacklist JSON databases.
 */

const fs = require('fs');
const path = require('path');

const whitelistPath = path.join(__dirname, '../data/whitelisted.json');
const blacklistPath = path.join(__dirname, '../data/blacklisted.json');

const readData = (filePath) => {
    if (!fs.existsSync(filePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return {};
    }
};

const writeData = (filePath, data) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
    fs.renameSync(temporaryPath, filePath);
};

const getWhitelistedData = () => readData(whitelistPath);

const saveWhitelistedUser = (discordId, username, platform) => {
    const data = getWhitelistedData();
    data[discordId] = { username, platform };
    writeData(whitelistPath, data);
};

const removeWhitelistedUser = (discordId) => {
    const data = getWhitelistedData();
    if (!data[discordId]) return;
    delete data[discordId];
    writeData(whitelistPath, data);
};

const findWhitelistedUser = (username, platform) => {
    const search = username.toLowerCase();
    for (const [discordId, entry] of Object.entries(getWhitelistedData())) {
        if (entry.platform === platform && entry.username.toLowerCase() === search) {
            return { discordId, ...entry };
        }
    }
    return null;
};

const getBlacklistedData = () => readData(blacklistPath);

const isBlacklisted = (discordId) => Boolean(getBlacklistedData()[discordId]);

const saveBlacklistedUser = (discordId, { username, platform, blacklistedBy }) => {
    const data = getBlacklistedData();
    data[discordId] = { username, platform, blacklistedBy, blacklistedAt: new Date().toISOString() };
    writeData(blacklistPath, data);
};

const removeBlacklistedUser = (discordId) => {
    const data = getBlacklistedData();
    if (!data[discordId]) return;
    delete data[discordId];
    writeData(blacklistPath, data);
};

module.exports = {
    getWhitelistedData,
    saveWhitelistedUser,
    removeWhitelistedUser,
    findWhitelistedUser,
    getBlacklistedData,
    isBlacklisted,
    saveBlacklistedUser,
    removeBlacklistedUser
};
