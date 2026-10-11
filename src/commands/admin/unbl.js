/**
 * Admin command handler to unban users from Minecraft, remove them from the blacklist and restore the Discord unwhitelisted role.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');
const { sendRconCommand, isCommandRejected } = require('../../utils/rcon');
const { getBanTarget } = require('../../utils/minecraft');
const { getBlacklistedData, removeBlacklistedUser } = require('../../utils/database');
const { isAdmin, createAccessDeniedEmbed } = require('../../utils/permissions');
const { toInlineText } = require('../../utils/formatters');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unblacklist')
        .setDescription('Rimuove un utente dalla blacklist: lo sbanna e ripristina il ruolo non whitelisted')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('discord')
                .setDescription('Utente Discord da rimuovere dalla blacklist')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const unwhitelistedRoleId = config.roles?.unwhitelisted;
        const blacklistedRoleId = config.roles?.blacklisted;

        if (!isAdmin(interaction.member)) {
            return interaction.editReply({ embeds: [createAccessDeniedEmbed()] });
        }

        const targetUser = interaction.options.getUser('discord');
        const userData = getBlacklistedData()[targetUser.id];

        if (!userData) {
            const embed = createEmbed({
                type: 'error',
                title: 'Utente Non Trovato',
                description: `L'utente ${targetUser} non risulta presente nella blacklist del database del bot.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const { username, platform } = userData;
        const rconResult = await sendRconCommand(interaction.client, `pardon ${getBanTarget(username, platform)}`, interaction.user);

        if (!rconResult.success) {
            const embed = createEmbed({
                type: 'error',
                title: 'Errore RCON',
                description: 'Impossibile connettersi al server Minecraft tramite RCON per rimuovere il ban.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        if (isCommandRejected(rconResult.response)) {
            const embed = createEmbed({
                type: 'error',
                title: 'Comando Rifiutato',
                description: `Il server ha rifiutato la rimozione del ban per \`${username}\` (${platform}). Risposta della console: \`${toInlineText(rconResult.response, 200)}\``
            });
            return interaction.editReply({ embeds: [embed] });
        }

        removeBlacklistedUser(targetUser.id);

        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            if (blacklistedRoleId) {
                await targetMember.roles.remove(blacklistedRoleId);
            }
            if (unwhitelistedRoleId) {
                await targetMember.roles.add(unwhitelistedRoleId);
            }
        } catch (roleError) {
            logger.error(`Role management failed while removing ${targetUser.id} from blacklist: ${roleError.message}`, interaction.client);
            const embed = createEmbed({
                type: 'warning',
                title: 'Blacklist Rimossa In-Game',
                description: `L'utente \`${username}\` (${platform}) è stato sbannato dal server, ma si è verificato un errore durante la gestione dei ruoli Discord.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = createEmbed({
            type: 'success',
            title: 'Blacklist Rimossa',
            description: `L'utente \`${username}\` è stato sbannato e rimosso dalla blacklist. Per farlo rientrare in whitelist usa \`/whitelist\`.`,
            fields: [
                { name: 'Minecraft Username', value: `\`${username}\``, inline: true },
                { name: 'Piattaforma', value: `\`${platform}\``, inline: true },
                { name: 'Account Discord', value: `${targetUser}`, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
