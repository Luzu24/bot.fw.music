/**
 * Event handler triggered when a new member joins the Discord server.
 */

const logger = require('../../utils/logger');
const config = require('../../../config.json');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'guildMemberAdd',
    once: false,
    async execute(member, client) {
        try {
            if (config.roles.autoroles && Array.isArray(config.roles.autoroles)) {
                for (const roleId of config.roles.autoroles) {
                    const role = member.guild.roles.cache.get(roleId);
                    if (role) {
                        await member.roles.add(role);
                    } else {
                        logger.warn(`Autorole with ID ${roleId} not found.`);
                    }
                }
            }

            const welcomeChannel = member.guild.channels.cache.get(config.channels.welcome);
            if (welcomeChannel) {
                const welcomeEmbed = createEmbed({
                    type: 'primary',
                    title: 'Benvenuto nel server!',
                    description: `Ciao ${member}, benvenuto in **${member.guild.name}**!\n\nPer giocare con noi nel server Minecraft:\n• **IP Java:** \`${config.minecraft.javaIp}\`\n• **IP Bedrock:** \`${config.minecraft.bedrockIp}\` (Porta: \`${config.minecraft.bedrockPort}\`)`,
                    thumbnail: member.user.displayAvatarURL({ dynamic: true })
                });

                await welcomeChannel.send({ embeds: [welcomeEmbed] });
            } else {
                logger.warn(`Welcome channel with ID ${config.channels.welcome} not found.`);
            }
        } catch (error) {
            logger.error(`Error handling guildMemberAdd for ${member.user.tag}:`, error);
        }
    }
};