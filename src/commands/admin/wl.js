/**
 * Admin command handler to add users to Minecraft whitelist and assign Discord whitelisted role.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');
const { sendRconCommand, isCommandRejected } = require('../../utils/rcon');
const { getWhitelistCommand } = require('../../utils/minecraft');
const { getWhitelistedData, saveWhitelistedUser, findWhitelistedUser, isBlacklisted } = require('../../utils/database');
const { isAdmin, createAccessDeniedEmbed } = require('../../utils/permissions');
const { toInlineText } = require('../../utils/formatters');
const logger = require('../../utils/logger');

const MOJANG_TIMEOUT = 5000;

const detectPlatform = async (username) => {
    try {
        const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, {
            signal: AbortSignal.timeout(MOJANG_TIMEOUT)
        });
        if (response.status === 200) return 'Java';
        if (response.status === 404 || response.status === 204) return 'Bedrock';
        return null;
    } catch {
        return null;
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Aggiunge un utente alla whitelist di Minecraft e gli assegna il ruolo Discord')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Username di Minecraft')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('discord')
                .setDescription('Utente Discord da associare')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('piattaforma')
                .setDescription('Piattaforma del giocatore (se omessa viene rilevata automaticamente)')
                .addChoices(
                    { name: 'Java', value: 'Java' },
                    { name: 'Bedrock', value: 'Bedrock' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        const whitelistedRoleId = config.roles?.whitelisted;
        const unwhitelistedRoleId = config.roles?.unwhitelisted;

        if (!isAdmin(interaction.member)) {
            return interaction.editReply({ embeds: [createAccessDeniedEmbed()] });
        }

        const username = interaction.options.getString('username').trim();
        const targetUser = interaction.options.getUser('discord');
        const selectedPlatform = interaction.options.getString('piattaforma');

        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch {
            const embed = createEmbed({
                type: 'error',
                title: 'Errore',
                description: 'Impossibile trovare l\'utente specificato nel server Discord.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        if (whitelistedRoleId && targetMember.roles.cache.has(whitelistedRoleId)) {
            const embed = createEmbed({
                type: 'warning',
                title: 'Utente già in Whitelist',
                description: `L'utente ${targetUser} ha già il ruolo Whitelisted.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        if (isBlacklisted(targetUser.id)) {
            const embed = createEmbed({
                type: 'error',
                title: 'Utente in Blacklist',
                description: `L'utente ${targetUser} è in blacklist. Rimuovilo prima con \`/unblacklist\`.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const existingEntry = getWhitelistedData()[targetUser.id];

        if (existingEntry) {
            const embed = createEmbed({
                type: 'warning',
                title: 'Utente già Registrato',
                description: `L'utente ${targetUser} risulta già associato a \`${existingEntry.username}\` (${existingEntry.platform}). Usa \`/unwhitelist\` prima di registrare un altro account.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const platform = selectedPlatform || await detectPlatform(username);

        if (!platform) {
            const embed = createEmbed({
                type: 'error',
                title: 'Piattaforma Non Rilevata',
                description: 'Impossibile determinare automaticamente la piattaforma dell\'username. Riesegui il comando specificando l\'opzione `piattaforma`.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const duplicate = findWhitelistedUser(username, platform);

        if (duplicate) {
            const embed = createEmbed({
                type: 'error',
                title: 'Username Già Registrato',
                description: `L'username \`${username}\` (${platform}) è già associato a <@${duplicate.discordId}>.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const rconResult = await sendRconCommand(interaction.client, getWhitelistCommand('add', username, platform), interaction.user);

        if (!rconResult.success) {
            const embed = createEmbed({
                type: 'error',
                title: 'Errore RCON',
                description: 'Impossibile connettersi al server Minecraft tramite RCON. Verifica che il server sia online e che RCON sia abilitato.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        if (isCommandRejected(rconResult.response)) {
            const embed = createEmbed({
                type: 'error',
                title: 'Comando Rifiutato',
                description: `Il server ha rifiutato la richiesta per \`${username}\` (${platform}). Risposta della console: \`${toInlineText(rconResult.response, 200)}\``
            });
            return interaction.editReply({ embeds: [embed] });
        }

        saveWhitelistedUser(targetUser.id, username, platform);

        try {
            if (whitelistedRoleId) {
                await targetMember.roles.add(whitelistedRoleId);
            }
            if (unwhitelistedRoleId) {
                await targetMember.roles.remove(unwhitelistedRoleId);
            }
        } catch (roleError) {
            logger.error(`Role management failed while whitelisting ${targetUser.id}: ${roleError.message}`, interaction.client);
            const embed = createEmbed({
                type: 'warning',
                title: 'Whitelist In-Game Completata',
                description: `L'utente \`${username}\` (${platform}) è stato aggiunto alla whitelist del server, ma si è verificato un errore durante la gestione dei ruoli Discord.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = createEmbed({
            type: 'success',
            title: 'Whitelist Aggiornata',
            description: `L'utente \`${username}\` è stato aggiunto con successo alla whitelist!`,
            fields: [
                { name: 'Minecraft Username', value: `\`${username}\``, inline: true },
                { name: selectedPlatform ? 'Piattaforma' : 'Piattaforma Rilevata', value: `\`${platform}\``, inline: true },
                { name: 'Account Discord', value: `${targetUser}`, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
