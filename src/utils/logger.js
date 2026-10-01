/**
 * Utility module for custom formatted console logging with timestamps.
 */

const formatTime = () => {
    const now = new Date();
    return now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
};

const logger = {
    info: (message) => {
        console.log(`[${formatTime()}] [INFO] ${message}`);
    },
    warn: (message) => {
        console.warn(`[${formatTime()}] [WARN] ${message}`);
    },
    error: (message, error = '') => {
        console.error(`[${formatTime()}] [ERROR] ${message}`, error);
    },
    debug: (message) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[${formatTime()}] [DEBUG] ${message}`);
        }
    }
};

module.exports = logger;