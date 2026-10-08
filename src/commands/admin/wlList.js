/**
 * Admin command handler to list whitelisted users with their platform.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');

const dataPath = path.join(__dirname, '../../data/whitelisted.json');

const MAX_DESCRIPTION_LENGTH = 4000;

const getWhitelistedData = () => {
    if (!fs.existsSync(dataPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch {
        return {};
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelistlist')
        .setDescription('Mostra la lista degli utenti in whitelist con la relativa piattaforma')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const adminRoleId = config.roles?.admin;

        if (adminRoleId && !interaction.member.roles.cache.has(adminRoleId)) {
            const embed = createEmbed({
                type: 'error',
                title: 'Accesso Negato',
                description: 'Non hai i permessi necessari per eseguire questo comando.'
            });
            return interaction.editReply({ embeds: [embed] });
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

        let description = '';
        let shown = 0;

        for (const line of lines) {
            const next = description ? `${description}\n${line}` : line;
            if (next.length > MAX_DESCRIPTION_LENGTH) break;
            description = next;
            shown++;
        }

        const hidden = lines.length - shown;
        if (hidden > 0) {
            description += `\n\n...e altri ${hidden} utenti non mostrati.`;
        }

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