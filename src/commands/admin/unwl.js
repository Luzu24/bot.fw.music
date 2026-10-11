/**
 * Admin command handler to remove users from Minecraft whitelist and remove Discord whitelisted role.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');
const { sendRconCommand, isCommandRejected } = require('../../utils/rcon');
const { getWhitelistCommand } = require('../../utils/minecraft');
const { getWhitelistedData, removeWhitelistedUser } = require('../../utils/database');
const { isAdmin, createAccessDeniedEmbed } = require('../../utils/permissions');
const { toInlineText } = require('../../utils/formatters');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwhitelist')
        .setDescription('Rimuove un utente dalla whitelist di Minecraft e gli rimuove il ruolo Discord')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('discord')
                .setDescription('Utente Discord da rimuovere')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const whitelistedRoleId = config.roles?.whitelisted;
        const unwhitelistedRoleId = config.roles?.unwhitelisted;

        if (!isAdmin(interaction.member)) {
            return interaction.editReply({ embeds: [createAccessDeniedEmbed()] });
        }

        const targetUser = interaction.options.getUser('discord');
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
        const rconResult = await sendRconCommand(interaction.client, getWhitelistCommand('remove', username, platform), interaction.user);

        if (!rconResult.success) {
            const embed = createEmbed({
                type: 'error',
                title: 'Errore RCON',
                description: 'Impossibile connettersi al server Minecraft tramite RCON per rimuovere la whitelist.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        removeWhitelistedUser(targetUser.id);

        try {
            logger.info(`[DEBUG UNWL] Attempting role update for ${targetUser.id}. WhitelistedRoleID: ${whitelistedRoleId}, UnwhitelistedRoleID:${unwhitelistedRoleId}`, interaction.client);
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            if (whitelistedRoleId) {
                await targetMember.roles.remove(whitelistedRoleId);
                logger.info(`[DEBUG UNWL] Removed whitelisted role from ${targetUser.id}`, interaction.client);
            }
            if (unwhitelistedRoleId) {
                await targetMember.roles.add(unwhitelistedRoleId);
                logger.info(`[DEBUG UNWL] Added unwhitelisted role to ${targetUser.id}`, interaction.client);
            }
        } catch (roleError) {
            logger.error(`[DEBUG UNWL ERROR] Role management failed: ${roleError.message}`, interaction.client);
        }

        if (isCommandRejected(rconResult.response)) {
            const embed = createEmbed({
                type: 'warning',
                title: 'Whitelist Rimossa dal Database',
                description: `L'utente \`${username}\` (${platform}) è stato rimosso dal database e dai ruoli, ma il server ha risposto: \`${toInlineText(rconResult.response, 200)}\`. Verifica la whitelist del server.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = createEmbed({
            type: 'success',
            title: 'Whitelist Rimossa',
            description: `L'utente \`${username}\` è stato rimosso con successo dalla whitelist!`,
            fields: [
                { name: 'Minecraft Username', value: `\`${username}\``, inline: true },
                { name: 'Piattaforma', value: `\`${platform}\``, inline: true },
                { name: 'Account Discord', value: `${targetUser}`, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
