/**
 * Admin command handler to add users to Minecraft whitelist and assign Discord whitelisted role.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');
const { sendRconCommand } = require('../../utils/rcon');

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
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const adminRoleId = config.roles?.admin;
        const whitelistedRoleId = config.roles?.whitelisted;

        if (adminRoleId && !interaction.member.roles.cache.has(adminRoleId)) {
            const embed = createEmbed({
                type: 'error',
                title: 'Accesso Negato',
                description: 'Non hai i permessi necessari per eseguire questo comando.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const username = interaction.options.getString('username').trim();
        const targetUser = interaction.options.getUser('discord');

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

        let isJava = false;
        try {
            const mojangResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
            if (mojangResponse.status === 200) {
                isJava = true;
            }
        } catch {
            isJava = false;
        }

        let platform = 'Bedrock';
        let rconResult;

        if (isJava) {
            platform = 'Java';
            rconResult = await sendRconCommand(interaction.client, `whitelist add ${username}`, interaction.user);
        } else {
            rconResult = await sendRconCommand(interaction.client, `fwhitelist add ${username}`, interaction.user);
        }

        if (!rconResult.success) {
            const embed = createEmbed({
                type: 'error',
                title: 'Errore RCON',
                description: 'Impossibile connettersi al server Minecraft tramite RCON. Verifica che il server sia online e che RCON sia abilitato.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            if (whitelistedRoleId) {
                await targetMember.roles.add(whitelistedRoleId);
            }
        } catch {
            const embed = createEmbed({
                type: 'warning',
                title: 'Whitelist In-Game Completata',
                description: `L'utente \`${username}\` (${platform}) è stato aggiunto alla whitelist del server, ma si è verificato un errore durante l'assegnazione del ruolo Discord.`
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = createEmbed({
            type: 'success',
            title: 'Whitelist Aggiornata',
            description: `L'utente \`${username}\` è stato aggiunto con successo alla whitelist!`,
            fields: [
                { name: 'Minecraft Username', value: `\`${username}\``, inline: true },
                { name: 'Piattaforma Rilevata', value: `\`${platform}\``, inline: true },
                { name: 'Account Discord', value: `${targetUser}`, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};