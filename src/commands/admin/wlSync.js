/**
 * Admin command handler to compare the bot database with the real Minecraft server whitelist.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { sendRconCommand } = require('../../utils/rcon');
const { parseWhitelist, getBanTarget } = require('../../utils/minecraft');
const { getWhitelistedData } = require('../../utils/database');
const { isAdmin, createAccessDeniedEmbed } = require('../../utils/permissions');
const { joinWithLimit } = require('../../utils/formatters');

const MAX_FIELD_LENGTH = 1000;

const formatList = (items) => joinWithLimit(items, {
    maxLength: MAX_FIELD_LENGTH,
    createSuffix: (hidden) => `\n...e altri ${hidden}`
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelistsync')
        .setDescription('Confronta il database del bot con la whitelist reale del server Minecraft')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        if (!isAdmin(interaction.member)) {
            return interaction.editReply({ embeds: [createAccessDeniedEmbed()] });
        }

        const rconResult = await sendRconCommand(interaction.client, 'whitelist list', interaction.user);

        if (!rconResult.success) {
            const embed = createEmbed({
                type: 'error',
                title: 'Errore RCON',
                description: 'Impossibile connettersi al server Minecraft tramite RCON per leggere la whitelist.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const serverPlayers = parseWhitelist(rconResult.response);
        const databaseEntries = Object.values(getWhitelistedData());

        const serverNames = new Set(serverPlayers.map(name => name.toLowerCase()));
        const knownNames = new Set();
        const missingOnServer = [];

        for (const { username, platform } of databaseEntries) {
            const candidates = [username, getBanTarget(username, platform)].map(name => name.toLowerCase());
            candidates.forEach(name => knownNames.add(name));

            if (!candidates.some(name => serverNames.has(name))) {
                missingOnServer.push(`\`${username}\` (${platform})`);
            }
        }

        const missingInDatabase = serverPlayers
            .filter(name => !knownNames.has(name.toLowerCase()))
            .map(name => `\`${name}\``);

        const fields = [
            { name: 'Nel database', value: `\`${databaseEntries.length}\``, inline: true },
            { name: 'Sul server', value: `\`${serverPlayers.length}\``, inline: true }
        ];

        if (missingOnServer.length > 0) {
            fields.push({ name: `Nel database ma non sul server (${missingOnServer.length})`, value: formatList(missingOnServer), inline: false });
        }

        if (missingInDatabase.length > 0) {
            fields.push({ name: `Sul server ma non nel database (${missingInDatabase.length})`, value: formatList(missingInDatabase), inline: false });
        }

        const inSync = missingOnServer.length === 0 && missingInDatabase.length === 0;

        const embed = createEmbed({
            type: inSync ? 'success' : 'warning',
            title: inSync ? 'Whitelist Sincronizzata' : 'Differenze Rilevate',
            description: inSync
                ? 'Il database del bot e la whitelist del server coincidono.'
                : 'Il database del bot e la whitelist del server non coincidono.',
            fields
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
