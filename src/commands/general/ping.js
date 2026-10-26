/**
 * Ping command handler to check Discord API latency and local Minecraft server connectivity.
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { pingJava, pingBedrock, logPingFailure } = require('../../utils/minecraft');

const formatLatency = (status) => {
    if (status.online) return `${status.latency < 10 ? status.latency.toFixed(1) : Math.round(status.latency)} ms`;
    return status.error === 'NOT_CONFIGURED' ? 'Non disponibile' : 'Offline';
};

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
        logPingFailure('/ping', 'Java', javaStatus);
        logPingFailure('/ping', 'Bedrock', bedrockStatus);

        const javaStatusText = formatLatency(javaStatus);
        const bedrockStatusText = formatLatency(bedrockStatus);

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
