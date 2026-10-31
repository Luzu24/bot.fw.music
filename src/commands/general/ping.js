/**
 * Ping command handler to check Discord API latency and local Minecraft server connectivity.
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Mostra la latenza del bot'),
    async execute(interaction) {
        const startTime = Date.now();
        await interaction.deferReply();
        const botLatency = Date.now() - startTime;

        const rawWsPing = interaction.client.ws.ping;
        const apiLatency = rawWsPing >= 0 ? `${Math.round(rawWsPing)} ms` : 'In calcolo...';

        const embed = createEmbed({
            type: 'primary',
            title: 'Stato di Rete',
            fields: [
                { name: 'Bot Latency', value: `${botLatency} ms`, inline: true },
                { name: 'API Latency', value: apiLatency, inline: true }
            ]
        });

        await interaction.editReply({ embeds: [embed] });
    }
};
