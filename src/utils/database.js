/**
 * Utility module for reading and writing the whitelist and blacklist JSON databases.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const BACKUP_RETENTION = 14;

const reportedCorruptFiles = new Set();

const getDataDirectory = () => process.env.DATA_DIR || path.join(__dirname, '../data');
const getWhitelistPath = () => path.join(getDataDirectory(), 'whitelisted.json');
const getBlacklistPath = () => path.join(getDataDirectory(), 'blacklisted.json');

const preserveCorruptFile = (filePath) => {
    if (reportedCorruptFiles.has(filePath)) return;
    reportedCorruptFiles.add(filePath);

    const preservedPath = `${filePath}.corrupt-${Date.now()}`;
    try {
        fs.copyFileSync(filePath, preservedPath);
    } catch { }

    logger.error(`${path.basename(filePath)} is not valid JSON: a copy was saved as ${path.basename(preservedPath)}.`);
};

const readData = (filePath) => {
    if (!fs.existsSync(filePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        preserveCorruptFile(filePath);
        return {};
    }
};

const createDailyBackup = (filePath) => {
    if (!fs.existsSync(filePath)) return;

    const backupDirectory = path.join(path.dirname(filePath), 'backups');
    const baseName = path.basename(filePath, '.json');
    const today = new Date().toISOString().slice(0, 10);
    const backupPath = path.join(backupDirectory, `${baseName}-${today}.json`);
    if (fs.existsSync(backupPath)) return;

    JSON.parse(fs.readFileSync(filePath, 'utf8'));

    fs.mkdirSync(backupDirectory, { recursive: true });
    fs.copyFileSync(filePath, backupPath);

    const backups = fs.readdirSync(backupDirectory)
        .filter(name => name.startsWith(`${baseName}-`) && name.endsWith('.json'))
        .sort();

    for (const name of backups.slice(0, Math.max(0, backups.length - BACKUP_RETENTION))) {
        fs.unlinkSync(path.join(backupDirectory, name));
    }
};

const writeData = (filePath, data) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    try {
        createDailyBackup(filePath);
    } catch (error) {
        logger.error(`Backup of ${path.basename(filePath)} skipped: ${error.message}`);
    }

    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
    fs.renameSync(temporaryPath, filePath);
    reportedCorruptFiles.delete(filePath);
};

const getWhitelistedData = () => readData(getWhitelistPath());

const saveWhitelistedUser = (discordId, username, platform) => {
    const data = getWhitelistedData();
    data[discordId] = { username, platform };
    writeData(getWhitelistPath(), data);
};

const removeWhitelistedUser = (discordId) => {
    const data = getWhitelistedData();
    if (!data[discordId]) return;
    delete data[discordId];
    writeData(getWhitelistPath(), data);
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

const getBlacklistedData = () => readData(getBlacklistPath());

const isBlacklisted = (discordId) => Boolean(getBlacklistedData()[discordId]);

const saveBlacklistedUser = (discordId, { username, platform, blacklistedBy }) => {
    const data = getBlacklistedData();
    data[discordId] = { username, platform, blacklistedBy, blacklistedAt: new Date().toISOString() };
    writeData(getBlacklistPath(), data);
};

const removeBlacklistedUser = (discordId) => {
    const data = getBlacklistedData();
    if (!data[discordId]) return;
    delete data[discordId];
    writeData(getBlacklistPath(), data);
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
