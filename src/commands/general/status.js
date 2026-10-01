/**
 * Status command handler to display Minecraft server online status and connection details.
 */

const { SlashCommandBuilder } = require('discord.js');
const net = require('net');
const dgram = require('dgram');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');

const checkTcpServer = (host, port) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);

        socket.connect({ port, host, family: 4 }, () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
};

const checkUdpServer = (host, port) => {
    return new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');

        const pingPacket = Buffer.from([
            0x01,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);

        let timer = setTimeout(() => {
            socket.close();
            resolve(false);
        }, 3000);

        socket.on('message', () => {
            clearTimeout(timer);
            socket.close();
            resolve(true);
        });

        socket.on('error', () => {
            clearTimeout(timer);
            socket.close();
            resolve(false);
        });

        socket.send(pingPacket, 0, pingPacket.length, port, host, (err) => {
            if (err) {
                clearTimeout(timer);
                socket.close();
                resolve(false);
            }
        });
    });
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Mostra lo stato del server Minecraft e le informazioni di connessione'),
    async execute(interaction) {
        await interaction.deferReply();

        const javaHost = config.minecraft.javaIp.trim();
        const javaPort = parseInt(config.minecraft.javaPort, 10) || 25565;

        const bedrockHost = config.minecraft.bedrockIp.trim();
        const bedrockPort = parseInt(config.minecraft.bedrockPort, 10) || 19132;

        const [isJavaOnline, isBedrockOnline] = await Promise.all([
            checkTcpServer(javaHost, javaPort),
            checkUdpServer(bedrockHost, bedrockPort)
        ]);

        const isOnline = isJavaOnline || isBedrockOnline;

        const embed = createEmbed({
            type: isOnline ? 'success' : 'error',
            title: 'Stato del Server Minecraft',
            description: isOnline
                ? '🟢 Il server è **Online**! Puoi connetterti usando gli indirizzi sottostanti.'
                : '🔴 Il server è attualmente **Offline**.',
            fields: [
                { name: 'IP Java', value: `\`${config.minecraft.javaIp}\``, inline: false },
                { name: 'IP Bedrock', value: `\`${config.minecraft.bedrockIp}\``, inline: true },
                { name: 'Porta Bedrock', value: `\`${config.minecraft.bedrockPort}\``, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};