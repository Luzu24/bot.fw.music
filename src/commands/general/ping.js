/**
 * Ping command handler to check Discord API latency and local Minecraft server connectivity.
 */

const { SlashCommandBuilder } = require('discord.js');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');
const { pingJava, pingBedrock, logPingFailure } = require('../../utils/minecraft');
const { measurePlayerPing, logProbeFailure, getProbeCountry, describeCountry } = require('../../utils/probe');

const splitTarget = (target) => {
    const separatorIndex = target.lastIndexOf(':');
    return { host: target.slice(0, separatorIndex), port: parseInt(target.slice(separatorIndex + 1), 10) };
};

const formatPlayerPing = (status, probe) => {
    if (status.error === 'NOT_CONFIGURED') return 'Non disponibile';
    if (!status.online) return 'Offline';
    if (!probe || probe.error) return 'Non disponibile';
    return `${Math.round(probe.latency)} ms`;
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

        const [javaProbe, bedrockProbe] = await Promise.all([
            javaStatus.online ? measurePlayerPing({ ...splitTarget(javaStatus.target), protocol: 'TCP' }) : null,
            bedrockStatus.online ? measurePlayerPing({ host: config.minecraft.bedrockIp.trim(), protocol: 'ICMP' }) : null
        ]);
        logProbeFailure('/ping', 'Java', javaProbe);
        logProbeFailure('/ping', 'Bedrock', bedrockProbe);

        const javaStatusText = formatPlayerPing(javaStatus, javaProbe);
        const bedrockStatusText = formatPlayerPing(bedrockStatus, bedrockProbe);
        const probeCountry = getProbeCountry();
        const location = probeCountry ? ` (${describeCountry(probeCountry)})` : '';

        const embed = createEmbed({
            type: (javaStatus.online || bedrockStatus.online) ? 'success' : 'warning',
            title: 'Stato di Rete',
            fields: [
                { name: 'Bot Latency', value: `${botLatency} ms`, inline: true },
                { name: 'API Latency', value: apiLatency, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: `Java Ping${location}`, value: javaStatusText, inline: true },
                { name: `Bedrock Ping${location}`, value: bedrockStatusText, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
