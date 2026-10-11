/**
 * Admin command handler to list blacklisted users with their platform and blacklist date.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { getBlacklistedData } = require('../../utils/database');
const { isAdmin, createAccessDeniedEmbed } = require('../../utils/permissions');
const { joinWithLimit } = require('../../utils/formatters');

const MAX_DESCRIPTION_LENGTH = 4000;

const formatDate = (isoDate) => {
    const timestamp = Math.floor(new Date(isoDate).getTime() / 1000);
    return Number.isNaN(timestamp) ? null : `<t:${timestamp}:d>`;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklistlist')
        .setDescription('Mostra la lista degli utenti in blacklist con la relativa piattaforma')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        if (!isAdmin(interaction.member)) {
            return interaction.editReply({ embeds: [createAccessDeniedEmbed()] });
        }

        const entries = Object.entries(getBlacklistedData());

        if (entries.length === 0) {
            const embed = createEmbed({
                type: 'warning',
                title: 'Blacklist Vuota',
                description: 'Non risulta nessun utente registrato in blacklist nel database del bot.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const lines = entries.map(([discordId, { username, platform, blacklistedAt }], index) => {
            const parts = [`${index + 1}. \`${username}\``, `\`${platform}\``, `<@${discordId}>`];
            const date = formatDate(blacklistedAt);
            if (date) parts.push(date);
            return parts.join(' • ');
        });

        const description = joinWithLimit(lines, {
            maxLength: MAX_DESCRIPTION_LENGTH,
            createSuffix: (hidden) => `\n\n...e altri ${hidden} utenti non mostrati.`
        });

        const javaCount = entries.filter(([, userData]) => userData.platform === 'Java').length;
        const bedrockCount = entries.filter(([, userData]) => userData.platform === 'Bedrock').length;

        const embed = createEmbed({
            type: 'error',
            title: 'Lista Blacklist',
            description,
            fields: [
                { name: 'Totale', value: `\`${entries.length}\``, inline: true },
                { name: 'Java', value: `\`${javaCount}\``, inline: true },
                { name: 'Bedrock', value: `\`${bedrockCount}\``, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
