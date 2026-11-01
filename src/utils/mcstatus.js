/**
 * Utility module for checking Bedrock server status from the internet through mcstatus.io and mcsrvstat.us.
 */

const REQUEST_TIMEOUT = 7000;
const SUCCESS_CACHE_TTL = 60 * 1000;
const FAILURE_CACHE_TTL = 30 * 1000;

const SOURCES = [
    { name: 'mcstatus.io', buildUrl: (host, port) => `https://api.mcstatus.io/v2/status/bedrock/${host}:${port}` },
    { name: 'mcsrvstat.us', buildUrl: (host, port) => `https://api.mcsrvstat.us/bedrock/3/${host}:${port}` }
];

const cache = new Map();

const readText = (value) => {
    if (Array.isArray(value)) return value.join(' ').trim() || null;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const describeError = (error) => {
    if (error.name === 'TimeoutError') return 'timed out';
    const code = error.cause?.code;
    return code ? `${error.message} (${code})` : error.message;
};

const querySource = async (source, host, port) => {
    try {
        const response = await fetch(source.buildUrl(host, port), {
            headers: { Accept: 'application/json', 'User-Agent': 'bot.fw.music' },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (typeof data?.online !== 'boolean') throw new Error('unexpected response');

        return {
            source: source.name,
            online: data.online,
            players: data.players ? { online: data.players.online ?? 0, max: data.players.max ?? 0 } : null,
            version: readText(typeof data.version === 'string' ? data.version : data.version?.name),
            motd: readText(data.motd?.clean)
        };
    } catch (error) {
        return { source: source.name, error: describeError(error) };
    }
};

const combine = (results) => {
    const online = results.find(result => result.online === true);
    if (online) return online;

    const offline = results.find(result => result.online === false);
    if (offline) return offline;

    return { error: results.map(result => `${result.source}: ${result.error}`).join('; ') };
};

const fetchExternalBedrockStatus = ({ host, port }) => {
    const key = `${host}:${port}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < cached.ttl) return cached.promise;

    const entry = { at: Date.now(), ttl: SUCCESS_CACHE_TTL, promise: null };
    entry.promise = Promise.all(SOURCES.map(source => querySource(source, host, port))).then((results) => {
        const combined = combine(results);
        if (combined.error) entry.ttl = FAILURE_CACHE_TTL;
        return combined;
    });

    cache.set(key, entry);
    return entry.promise;
};

module.exports = { fetchExternalBedrockStatus };
