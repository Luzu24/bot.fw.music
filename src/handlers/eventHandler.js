/**
 * Event handler module for loading and registering client and guild events recursively.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const loadEvents = (client) => {
    const eventsPath = path.join(__dirname, '../events');
    const eventFolders = fs.readdirSync(eventsPath);

    for (const folder of eventFolders) {
        const folderPath = path.join(eventsPath, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const eventFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(folderPath, file);
            const event = require(filePath);

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }

            logger.info(`Loaded event: ${event.name}`);
        }
    }
};

module.exports = { loadEvents };