const { SlashCommandBuilder } = require('discord.js');
const net = require('net');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');

const checkMinecraftServer = (host, port) => {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();

        socket.setTimeout(3000);

        socket.connect(port, host, () => {
            const latency = Date.now() - start;
            socket.destroy();
            resolve({ online: true, latency });
        });

        socket.on('error', () => {
            socket.destroy();
            resolve({ online: false, latency: null });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ online: false, latency: null });
        });
    });
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Mostra la latenza del bot e lo stato del server Minecraft'),
    async execute(interaction, client) {
        const sent = await interaction.reply({ content: 'Misurazione della latenza in corso...', fetchReply: true });
        const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        const mcHost = config.minecraft.javaIp.trim();
        const mcPort = parseInt(config.minecraft.bedrockPort, 10) || 25565;

        const mcStatus = await checkMinecraftServer(mcHost, mcPort);

        const mcStatusText = mcStatus.online
            ? `Online (${mcStatus.latency} ms)`
            : 'Offline';

        const embed = createEmbed({
            type: mcStatus.online ? 'success' : 'warning',
            title: 'Stato di Rete',
            fields: [
                { name: 'Bot Latency', value: `${botLatency} ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency} ms`, inline: true },
                { name: 'Minecraft Server', value: mcStatusText, inline: true }
            ]
        });

        await interaction.editReply({ content: null, embeds: [embed] });
    }
};