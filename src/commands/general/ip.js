/**
 * IP command handler to display Minecraft server IP addresses and port for Java and Bedrock.
 */

const { SlashCommandBuilder } = require('discord.js');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ip')
        .setDescription('Mostra gli indirizzi IP per connettersi al server Minecraft'),
    async execute(interaction) {
        const embed = createEmbed({
            type: 'primary',
            title: 'Indirizzi di Connessione',
            description: 'Usa i dettagli sottostanti per entrare nel server Minecraft:',
            fields: [
                { name: 'IP Java', value: `\`${config.minecraft.javaIp}\``, inline: false },
                { name: 'IP Bedrock', value: `\`${config.minecraft.bedrockIp}\``, inline: true },
                { name: 'Porta Bedrock', value: `\`${config.minecraft.bedrockPort}\``, inline: true }
            ]
        });

        await interaction.reply({ embeds: [embed] });
    }
};