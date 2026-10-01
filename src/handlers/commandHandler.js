/**
 * Command handler module for loading and registering application slash commands recursively.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const loadCommands = (client) => {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);

            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                logger.info(`Loaded command: ${command.data.name}`);
            } else {
                logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }
};

module.exports = { loadCommands };