/**
 * Admin command handler to remove users from Minecraft whitelist and remove Discord whitelisted role.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');
const { sendRconCommand } = require('../../utils/rcon');
const logger = require('../../utils/logger');

const dataPath = path.join(__dirname, '../../data/whitelisted.json');

const getWhitelistedData = () => {
    if (!fs.existsSync(dataPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch {
        return {};
    }
};

const removeFromDatabase = (discordId) => {
    const data = getWhitelistedData();
    if (data[discordId]) {
        delete data[discordId];
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    }
};

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

        const adminRoleId = config.roles?.admin;
        const whitelistedRoleId = config.roles?.whitelisted;
        const unwhitelistedRoleId = config.roles?.unwhitelisted;

        if (adminRoleId && !interaction.member.roles.cache.has(adminRoleId)) {
            const embed = createEmbed({
                type: 'error',
                title: 'Accesso Negato',
                description: 'Non hai i permessi necessari per eseguire questo comando.'
            });
            return interaction.editReply({ embeds: [embed] });
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
        const command = platform === 'Java' ? `whitelist remove ${username}` : `fwhitelist remove ${username}`;
        const rconResult = await sendRconCommand(interaction.client, command, interaction.user);

        if (!rconResult.success) {
            const embed = createEmbed({
                type: 'error',
                title: 'Errore RCON',
                description: 'Impossibile connettersi al server Minecraft tramite RCON per rimuovere la whitelist.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        removeFromDatabase(targetUser.id);

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