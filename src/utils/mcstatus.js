/**
 * Utility module for checking Bedrock server status from the internet through mcstatus.io.
 */

const API_URL = 'https://api.mcstatus.io/v2/status/bedrock';
const REQUEST_TIMEOUT = 4000;
const SUCCESS_CACHE_TTL = 60 * 1000;
const FAILURE_CACHE_TTL = 30 * 1000;

const cache = new Map();

const requestStatus = async (host, port) => {
    const response = await fetch(`${API_URL}/${host}:${port}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'bot.fw.music' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (typeof data?.online !== 'boolean') throw new Error('unexpected response');

    return {
        online: data.online,
        players: data.players ? { online: data.players.online ?? 0, max: data.players.max ?? 0 } : null,
        version: data.version?.name || null,
        motd: data.motd?.clean || null
    };
};

const fetchExternalBedrockStatus = ({ host, port }) => {
    const key = `${host}:${port}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < cached.ttl) return cached.promise;

    const entry = { at: Date.now(), ttl: SUCCESS_CACHE_TTL, promise: null };
    entry.promise = requestStatus(host, port).catch((error) => {
        entry.ttl = FAILURE_CACHE_TTL;
        return { error: error.message };
    });

    cache.set(key, entry);
    return entry.promise;
};

module.exports = { fetchExternalBedrockStatus };
