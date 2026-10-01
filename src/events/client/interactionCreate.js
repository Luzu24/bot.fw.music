/**
 * Event handler triggered when an interaction (slash command, button, etc.) is created.
 */

const logger = require('../../utils/logger');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) return;

        const options = interaction.options.data
            .map(opt => `${opt.name}:${opt.value}`)
            .join(', ');

        const optionsText = options ? `{${options}}` : '';
        logger.info(`${interaction.user} ha eseguito /${interaction.commandName}${optionsText}`.trim(), interaction.client);

        try {
            await command.execute(interaction);
        } catch (error) {
            logger.error(`Errore durante l'esecuzione del comando /${interaction.commandName}:${error.message}`, interaction.client);
            const content = 'Si è verificato un errore durante l\'esecuzione del comando.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content, ephemeral: true });
            } else {
                await interaction.reply({ content, ephemeral: true });
            }
        }
    }
};