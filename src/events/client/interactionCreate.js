/**
 * Event handler triggered when an interaction (slash command, button, etc.) is created.
 */

const logger = require('../../utils/logger');
const { createErrorEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            logger.warn(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction, client);
        } catch (error) {
            logger.error(`Error executing ${interaction.commandName}:`, error);

            const errorEmbed = createErrorEmbed('Si è verificato un errore durante l\'esecuzione del comando.');

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    }
};