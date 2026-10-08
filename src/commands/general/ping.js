/**
 * Ping command handler to check Discord API latency and local Minecraft server connectivity.
 */

const { SlashCommandBuilder } = require('discord.js');
const net = require('net');
const dgram = require('dgram');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');

const checkTcpServer = (host, port) => {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();

        socket.setTimeout(3000);

        socket.connect({ port, host, family: 4 }, () => {
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

const checkUdpServer = (host, port) => {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = dgram.createSocket('udp4');

        const pingPacket = Buffer.from([
            0x01,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);

        let timer = setTimeout(() => {
            socket.close();
            resolve({ online: false, latency: null });
        }, 3000);

        socket.on('message', () => {
            const latency = Date.now() - start;
            clearTimeout(timer);
            socket.close();
            resolve({ online: true, latency });
        });

        socket.on('error', () => {
            clearTimeout(timer);
            socket.close();
            resolve({ online: false, latency: null });
        });

        socket.send(pingPacket, 0, pingPacket.length, port, host, (err) => {
            if (err) {
                clearTimeout(timer);
                socket.close();
                resolve({ online: false, latency: null });
            }
        });
    });
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

        const javaHost = config.minecraft.javaIp.trim();
        const javaPort = parseInt(config.minecraft.javaPort, 10) || 25565;

        const bedrockHost = config.minecraft.bedrockIp.trim();
        const bedrockPort = parseInt(config.minecraft.bedrockPort, 10) || 19132;

        const javaStatus = await checkTcpServer(javaHost, javaPort);
        const bedrockStatus = await checkUdpServer(bedrockHost, bedrockPort);

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