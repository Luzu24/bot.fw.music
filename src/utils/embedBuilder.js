/**
 * Utility module for generating consistent Discord embeds.
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

const createEmbed = ({ type = 'primary', title, description, fields = [], footer, image, thumbnail }) => {
    const embed = new EmbedBuilder()
        .setColor(config.colors[type] || config.colors.primary)
        .setTimestamp();

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (fields.length > 0) embed.addFields(fields);
    if (image) embed.setImage(image);
    if (thumbnail) embed.setThumbnail(thumbnail);

    if (footer) {
        embed.setFooter(typeof footer === 'string' ? { text: footer } : footer);
    }

    return embed;
};

const createSuccessEmbed = (description, title = 'Operazione completata') => {
    return createEmbed({ type: 'success', title, description });
};

const createErrorEmbed = (description, title = 'Errore') => {
    return createEmbed({ type: 'error', title, description });
};

const createWarningEmbed = (description, title = 'Attenzione') => {
    return createEmbed({ type: 'warning', title, description });
};

module.exports = {
    createEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    createWarningEmbed
};