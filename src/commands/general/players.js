/**
 * Players command handler to display users currently online on the Minecraft server.
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { sendRconCommand } = require('../../utils/rcon');
const { pingJava, parsePlayerList } = require('../../utils/minecraft');
const { joinWithLimit } = require('../../utils/formatters');

const MAX_DESCRIPTION_LENGTH = 4000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('players')
        .setDescription('Mostra i giocatori attualmente online sul server Minecraft'),
    async execute(interaction) {
        await interaction.deferReply();

        let playerData = null;

        const rconResult = await sendRconCommand(null, 'list', null);
        if (rconResult.success) {
            playerData = parsePlayerList(rconResult.response);
        }

        if (!playerData) {
            const javaStatus = await pingJava();
            if (javaStatus.online && javaStatus.players) {
                playerData = {
                    online: javaStatus.players.online,
                    max: javaStatus.players.max,
                    players: javaStatus.players.sample
                };
            }
        }

        if (!playerData) {
            const embed = createEmbed({
                type: 'error',
                title: 'Server Offline',
                description: 'Impossibile recuperare la lista dei giocatori: il server risulta offline o non raggiungibile.'
            });
            return interaction.editReply({ embeds: [embed] });
        }

        let description = 'Nessun giocatore online al momento.';

        if (playerData.players.length > 0) {
            description = joinWithLimit(playerData.players.map(name => `\`${name}\``), {
                maxLength: MAX_DESCRIPTION_LENGTH,
                separator: ', ',
                createSuffix: (hidden) => ` ...e altri ${hidden}`
            });
        } else if (playerData.online > 0) {
            description = 'La lista dei nomi non è disponibile al momento.';
        }

        const embed = createEmbed({
            type: 'primary',
            title: 'Giocatori Online',
            description,
            fields: [
                { name: 'Online', value: `\`${playerData.online}/${playerData.max}\``, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
