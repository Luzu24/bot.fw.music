/**
 * Help command displaying available bot commands and server info.
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const config = require('../../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra la lista dei comandi disponibili e le informazioni del server'),
    async execute(interaction) {
        const embed = createEmbed({
            type: 'primary',
            title: 'Guida ai Comandi',
            description: 'Ecco la lista dei comandi disponibili e le informazioni per connettersi al server Minecraft:',
            fields: [
                { name: '/ping', value: 'Verifica la latenza del bot e lo stato del server Minecraft.', inline: false },
                { name: '/help', value: 'Mostra questo messaggio di aiuto.', inline: false },
                { name: 'IP Java', value: `\`${config.minecraft.javaIp}\``, inline: true },
                { name: 'IP Bedrock', value: `\`${config.minecraft.bedrockIp}:${config.minecraft.bedrockPort}\``, inline: true }
            ]
        });

        await interaction.reply({ embeds: [embed] });
    }
};