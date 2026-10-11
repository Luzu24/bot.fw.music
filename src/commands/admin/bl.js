/**
 * Admin command handler to remove users from Minecraft whitelist, ban them and assign Discord blacklisted role.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');
const { sendRconCommand, isCommandRejected } = require('../../utils/rcon');
const { getWhitelistCommand, getBanTarget } = require('../../utils/minecraft');
const { getWhitelistedData, removeWhitelistedUser, saveBlacklistedUser, isBlacklisted } = require('../../utils/database');
const { isAdmin, createAccessDeniedEmbed } = require('../../utils/permissions');
const { toInlineText } = require('../../utils/formatters');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Inserisce un utente in blacklist: lo rimuove dalla whitelist, lo banna e aggiorna i ruoli')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('discord')
                .setDescription('Utente Discord da inserire in blacklist')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const whitelistedRoleId = config.roles?.whitelisted;
        const unwhitelistedRoleId = config.roles?.unwhitelisted;
        const blacklistedRoleId = config.roles?.blacklisted;

        if (!isAdmin(interaction.member)) {
            return interaction.editReply({ embeds: [createAccessDeniedEmbed()] });
        }

        const targetUser = interaction.options.getUser('discord');

        if (isBlacklisted(targetUser.id)) {
            const embed = createEmbed({
                type: 'warning',
                title: 'Utente già in Blacklist',
                description: `L'utente ${targetUser} è già presente nella blacklist.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const data = getWhitelistedData();
        const userData = data[targetUser.id];

        if (!userData) {
            const embed = createEmbed({
                type: 'error',
                title: 'Utente Non Trovato',
                description: `L'utente ${targetUser} non risulta registrato in whitelist nel database del bot.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const { username, platform } = userData;

        const unwhitelistResult = await sendRconCommand(interaction.client, getWhitelistCommand('remove', username, platform), interaction.user);

        if (!unwhitelistResult.success) {
            const embed = createEmbed({
                type: 'error',
                title: 'Errore RCON',
                description: 'Impossibile connettersi al server Minecraft tramite RCON per rimuovere la whitelist.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const banResult = await sendRconCommand(interaction.client, `ban ${getBanTarget(username, platform)}`, interaction.user);

        if (!banResult.success) {
            const embed = createEmbed({
                type: 'error',
                title: 'Errore RCON',
                description: `L'utente \`${username}\` è stato rimosso dalla whitelist del server, ma non è stato possibile eseguire il ban tramite RCON. Riesegui il comando.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        if (isCommandRejected(banResult.response)) {
            const embed = createEmbed({
                type: 'error',
                title: 'Ban Rifiutato',
                description: `L'utente \`${username}\` è stato rimosso dalla whitelist del server, ma il ban è stato rifiutato. Risposta della console: \`${toInlineText(banResult.response, 200)}\``
            });
            return interaction.editReply({ embeds: [embed] });
        }

        saveBlacklistedUser(targetUser.id, { username, platform, blacklistedBy: interaction.user.id });
        removeWhitelistedUser(targetUser.id);

        try {
            logger.info(`[DEBUG BL] Attempting role update for ${targetUser.id}. WhitelistedRoleID: ${whitelistedRoleId}, UnwhitelistedRoleID: ${unwhitelistedRoleId}, BlacklistedRoleID: ${blacklistedRoleId}`, interaction.client);
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            if (whitelistedRoleId) {
                await targetMember.roles.remove(whitelistedRoleId);
                logger.info(`[DEBUG BL] Removed whitelisted role from ${targetUser.id}`, interaction.client);
            }
            if (unwhitelistedRoleId) {
                await targetMember.roles.remove(unwhitelistedRoleId);
                logger.info(`[DEBUG BL] Removed unwhitelisted role from ${targetUser.id}`, interaction.client);
            }
            if (blacklistedRoleId) {
                await targetMember.roles.add(blacklistedRoleId);
                logger.info(`[DEBUG BL] Added blacklisted role to ${targetUser.id}`, interaction.client);
            }
        } catch (roleError) {
            logger.error(`[DEBUG BL ERROR] Role management failed: ${roleError.message}`, interaction.client);
            const embed = createEmbed({
                type: 'warning',
                title: 'Blacklist In-Game Completata',
                description: `L'utente \`${username}\` (${platform}) è stato rimosso dalla whitelist e bannato dal server, ma si è verificato un errore durante la gestione dei ruoli Discord.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = createEmbed({
            type: 'success',
            title: 'Blacklist Aggiornata',
            description: `L'utente \`${username}\` è stato rimosso dalla whitelist e inserito con successo in blacklist!`,
            fields: [
                { name: 'Minecraft Username', value: `\`${username}\``, inline: true },
                { name: 'Piattaforma', value: `\`${platform}\``, inline: true },
                { name: 'Account Discord', value: `${targetUser}`, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
