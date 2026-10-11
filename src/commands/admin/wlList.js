/**
 * Admin command handler to list whitelisted users with their platform.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { getWhitelistedData } = require('../../utils/database');
const { isAdmin, createAccessDeniedEmbed } = require('../../utils/permissions');
const { joinWithLimit } = require('../../utils/formatters');

const MAX_DESCRIPTION_LENGTH = 4000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelistlist')
        .setDescription('Mostra la lista degli utenti in whitelist con la relativa piattaforma')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        if (!isAdmin(interaction.member)) {
            return interaction.editReply({ embeds: [createAccessDeniedEmbed()] });
        }

        const entries = Object.entries(getWhitelistedData());

        if (entries.length === 0) {
            const embed = createEmbed({
                type: 'warning',
                title: 'Whitelist Vuota',
                description: 'Non risulta nessun utente registrato in whitelist nel database del bot.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const lines = entries.map(([discordId, { username, platform }], index) =>
            `${index + 1}. \`${username}\` • \`${platform}\` • <@${discordId}>`
        );

        const description = joinWithLimit(lines, {
            maxLength: MAX_DESCRIPTION_LENGTH,
            createSuffix: (hidden) => `\n\n...e altri ${hidden} utenti non mostrati.`
        });

        const javaCount = entries.filter(([, userData]) => userData.platform === 'Java').length;
        const bedrockCount = entries.filter(([, userData]) => userData.platform === 'Bedrock').length;

        const embed = createEmbed({
            type: 'primary',
            title: 'Lista Whitelist',
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
