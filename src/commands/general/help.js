/**
 * Help command displaying available bot commands and server info.
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { isAdmin } = require('../../utils/permissions');
const { joinWithLimit } = require('../../utils/formatters');
const config = require('../../../config.json');

const ADMIN_CATEGORY = 'admin';
const CATEGORY_ORDER = ['general', 'admin'];
const CATEGORY_LABELS = {
    general: 'Comandi Generali',
    admin: 'Comandi Admin'
};
const MAX_FIELD_LENGTH = 1000;

const getCategoryPosition = (category) => {
    const position = CATEGORY_ORDER.indexOf(category);
    return position === -1 ? CATEGORY_ORDER.length : position;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra la lista dei comandi disponibili e le informazioni del server'),
    async execute(interaction) {
        const userIsAdmin = isAdmin(interaction.member);
        const categories = new Map();

        for (const command of interaction.client.commands.values()) {
            const category = command.category || 'general';
            if (category === ADMIN_CATEGORY && !userIsAdmin) continue;

            if (!categories.has(category)) categories.set(category, []);
            categories.get(category).push(`\`/${command.data.name}\` — ${command.data.description}`);
        }

        const commandFields = [...categories.entries()]
            .sort(([a], [b]) => getCategoryPosition(a) - getCategoryPosition(b))
            .map(([category, lines]) => ({
                name: CATEGORY_LABELS[category] || category,
                value: joinWithLimit(lines, {
                    maxLength: MAX_FIELD_LENGTH,
                    createSuffix: (hidden) => `\n...e altri ${hidden} comandi`
                }),
                inline: false
            }));

        const embed = createEmbed({
            type: 'primary',
            title: 'Guida ai Comandi',
            description: 'Ecco la lista dei comandi disponibili e le informazioni per connettersi al server Minecraft:',
            fields: [
                ...commandFields,
                { name: 'IP Java', value: `\`${config.minecraft.javaIp}\``, inline: true },
                { name: 'IP Bedrock', value: `\`${config.minecraft.bedrockIp}:${config.minecraft.bedrockPort}\``, inline: true }
            ]
        });

        await interaction.reply({ embeds: [embed] });
    }
};
