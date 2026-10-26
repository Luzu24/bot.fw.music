/**
 * Admin command handler to sync the Discord nickname of whitelisted users with their Minecraft username.
 */

const { SlashCommandBuilder, PermissionFlagsBits, RESTJSONErrorCodes } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { getWhitelistedData } = require('../../utils/database');
const { syncNickname } = require('../../utils/nickname');
const { isAdmin, createAccessDeniedEmbed } = require('../../utils/permissions');
const { joinWithLimit } = require('../../utils/formatters');
const logger = require('../../utils/logger');

const MAX_FIELD_LENGTH = 1000;

const formatList = (items) => joinWithLimit(items, {
    maxLength: MAX_FIELD_LENGTH,
    createSuffix: (hidden) => `\n...e altri ${hidden}`
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('syncnick')
        .setDescription('Imposta il nickname Discord degli utenti in whitelist uguale al loro username Minecraft')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('discord')
                .setDescription('Sincronizza solo questo utente (se omesso, tutti gli utenti in whitelist)')),

    async execute(interaction) {
        await interaction.deferReply();

        if (!isAdmin(interaction.member)) {
            return interaction.editReply({ embeds: [createAccessDeniedEmbed()] });
        }

        const targetUser = interaction.options.getUser('discord');
        let entries = Object.entries(getWhitelistedData());

        if (targetUser) {
            entries = entries.filter(([discordId]) => discordId === targetUser.id);

            if (entries.length === 0) {
                const embed = createEmbed({
                    type: 'error',
                    title: 'Utente Non Trovato',
                    description: `L'utente ${targetUser} non risulta registrato in whitelist nel database del bot.`
                });
                return interaction.editReply({ embeds: [embed] });
            }
        }

        if (entries.length === 0) {
            const embed = createEmbed({
                type: 'warning',
                title: 'Whitelist Vuota',
                description: 'Non risulta nessun utente registrato in whitelist nel database del bot.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        const reason = `Nickname sincronizzato con lo username Minecraft (richiesto da ${interaction.user.username})`;
        let updated = 0;
        let unchanged = 0;
        const missing = [];
        const forbidden = [];
        const failed = [];

        for (const [discordId, { username }] of entries) {
            const label = `<@${discordId}> (\`${username}\`)`;
            let member;

            try {
                member = await interaction.guild.members.fetch(discordId);
            } catch (error) {
                if (error.code === RESTJSONErrorCodes.UnknownMember) {
                    missing.push(label);
                } else {
                    logger.error(`Member fetch failed during /syncnick for ${discordId}: ${error.message}`, interaction.client);
                    failed.push(label);
                }
                continue;
            }

            const result = await syncNickname(member, username, reason);

            if (result === 'updated') updated++;
            else if (result === 'unchanged') unchanged++;
            else if (result === 'forbidden') forbidden.push(label);
            else failed.push(label);
        }

        const fields = [
            { name: 'Totale', value: `\`${entries.length}\``, inline: true },
            { name: 'Aggiornati', value: `\`${updated}\``, inline: true },
            { name: 'Già corretti', value: `\`${unchanged}\``, inline: true }
        ];

        if (missing.length > 0) {
            fields.push({ name: `Non presenti nel server Discord (${missing.length})`, value: formatList(missing), inline: false });
        }

        if (forbidden.length > 0) {
            fields.push({ name: `Permessi insufficienti (${forbidden.length})`, value: formatList(forbidden), inline: false });
        }

        if (failed.length > 0) {
            fields.push({ name: `Errori (${failed.length})`, value: formatList(failed), inline: false });
        }

        const hasProblems = missing.length + forbidden.length + failed.length > 0;

        const embed = createEmbed({
            type: hasProblems ? 'warning' : 'success',
            title: hasProblems ? 'Nickname Sincronizzati con Avvisi' : 'Nickname Sincronizzati',
            description: hasProblems
                ? 'Alcuni nickname non sono stati aggiornati. Controlla i dettagli qui sotto.'
                : 'Tutti i nickname corrispondono allo username Minecraft.',
            fields
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
