/**
 * Admin command handler to look up the Minecraft account linked to a Discord user or vice versa.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { getWhitelistedData, getBlacklistedData } = require('../../utils/database');
const { getBanTarget } = require('../../utils/minecraft');
const { isAdmin, createAccessDeniedEmbed } = require('../../utils/permissions');
const { joinWithLimit } = require('../../utils/formatters');

const MAX_DESCRIPTION_LENGTH = 4000;

const formatEntry = (status, discordId, entry) => {
    const parts = [`**${status}**`, `<@${discordId}>`, `\`${entry.username}\``, `\`${entry.platform}\``];

    if (entry.blacklistedAt) {
        const timestamp = Math.floor(new Date(entry.blacklistedAt).getTime() / 1000);
        if (!Number.isNaN(timestamp)) parts.push(`<t:${timestamp}:d>`);
    }

    if (entry.blacklistedBy) parts.push(`da <@${entry.blacklistedBy}>`);

    return parts.join(' • ');
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Mostra l\'account Minecraft di un utente Discord o l\'utente Discord di uno username')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('discord')
                .setDescription('Utente Discord da cercare'))
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Username Minecraft da cercare')),

    async execute(interaction) {
        await interaction.deferReply();

        if (!isAdmin(interaction.member)) {
            return interaction.editReply({ embeds: [createAccessDeniedEmbed()] });
        }

        const targetUser = interaction.options.getUser('discord');
        const username = interaction.options.getString('username')?.trim();

        if (!targetUser && !username) {
            const embed = createEmbed({
                type: 'error',
                title: 'Parametro Mancante',
                description: 'Specifica almeno un utente Discord o uno username Minecraft da cercare.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const sources = [
            ['Whitelist', getWhitelistedData()],
            ['Blacklist', getBlacklistedData()]
        ];

        const results = [];

        for (const [status, source] of sources) {
            for (const [discordId, entry] of Object.entries(source)) {
                const matches = targetUser
                    ? discordId === targetUser.id
                    : [entry.username, getBanTarget(entry.username, entry.platform)]
                        .some(name => name.toLowerCase() === username.toLowerCase());

                if (matches) results.push(formatEntry(status, discordId, entry));
            }
        }

        if (results.length === 0) {
            const embed = createEmbed({
                type: 'warning',
                title: 'Nessun Risultato',
                description: targetUser
                    ? `L'utente ${targetUser} non risulta né in whitelist né in blacklist.`
                    : `Lo username \`${username}\` non risulta né in whitelist né in blacklist.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = createEmbed({
            type: 'primary',
            title: 'Risultato Ricerca',
            description: joinWithLimit(results, {
                maxLength: MAX_DESCRIPTION_LENGTH,
                createSuffix: (hidden) => `\n\n...e altri ${hidden} risultati non mostrati.`
            })
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
