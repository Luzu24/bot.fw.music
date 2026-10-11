/**
 * Ping command handler to check Discord API latency and local Minecraft server connectivity.
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { pingJava, pingBedrock } = require('../../utils/minecraft');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Mostra la latenza del bot e lo stato del server Minecraft'),
    async execute(interaction) {
        const startTime = Date.now();
        await interaction.deferReply();
        const botLatency = Date.now() - startTime;

        const rawWsPing = interaction.client.ws.ping;
        const apiLatency = rawWsPing >= 0 ? `${Math.round(rawWsPing)} ms` : 'In calcolo...';

        const [javaStatus, bedrockStatus] = await Promise.all([pingJava(), pingBedrock()]);

        const javaStatusText = javaStatus.online ? `${javaStatus.latency} ms` : 'Offline';
        const bedrockStatusText = bedrockStatus.online ? `${bedrockStatus.latency} ms` : 'Offline';

        const embed = createEmbed({
            type: (javaStatus.online || bedrockStatus.online) ? 'success' : 'warning',
            title: 'Stato di Rete',
            fields: [
                { name: 'Bot Latency', value: `${botLatency} ms`, inline: true },
                { name: 'API Latency', value: apiLatency, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Java Ping', value: javaStatusText, inline: true },
                { name: 'Bedrock Ping', value: bedrockStatusText, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
