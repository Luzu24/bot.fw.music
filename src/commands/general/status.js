/**
 * Status command handler to display Minecraft server online status and connection details.
 */

const { SlashCommandBuilder } = require('discord.js');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');
const { pingJava, pingBedrock } = require('../../utils/minecraft');

const formatServerStatus = (status) => {
    if (!status.online) return ':red_circle: Offline';

    const parts = [':green_circle: Online'];
    if (status.players) parts.push(`${status.players.online}/${status.players.max} giocatori`);
    if (status.version) parts.push(status.version);

    return parts.join(' • ');
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Mostra lo stato del server Minecraft e le informazioni di connessione'),
    async execute(interaction) {
        await interaction.deferReply();

        const [javaStatus, bedrockStatus] = await Promise.all([pingJava(), pingBedrock()]);

        const isOnline = javaStatus.online || bedrockStatus.online;

        const embed = createEmbed({
            type: isOnline ? 'success' : 'error',
            title: 'Stato del Server Minecraft',
            description: isOnline
                ? ':green_circle: Il server è **Online**! Puoi connetterti usando gli indirizzi sottostanti.'
                : ':red_circle: Il server è attualmente **Offline**.',
            fields: [
                { name: 'IP Java', value: `\`${config.minecraft.javaIp}\``, inline: false },
                { name: 'IP Bedrock', value: `\`${config.minecraft.bedrockIp}\``, inline: true },
                { name: 'Porta Bedrock', value: `\`${config.minecraft.bedrockPort}\``, inline: true },
                { name: 'Stato Java', value: formatServerStatus(javaStatus), inline: false },
                { name: 'Stato Bedrock', value: formatServerStatus(bedrockStatus), inline: false }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
