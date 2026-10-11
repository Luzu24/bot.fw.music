/**
 * Utility module for admin role checks shared by admin commands.
 */

const config = require('../../config.json');
const { createEmbed } = require('./embedBuilder');

const isAdmin = (member) => {
    const adminRoleId = config.roles?.admin;
    if (!adminRoleId) return true;
    return Boolean(member?.roles?.cache?.has(adminRoleId));
};

const createAccessDeniedEmbed = () => createEmbed({
    type: 'error',
    title: 'Accesso Negato',
    description: 'Non hai i permessi necessari per eseguire questo comando.'
});

module.exports = { isAdmin, createAccessDeniedEmbed };
