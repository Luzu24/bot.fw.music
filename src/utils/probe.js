const config = require('../../config.json');
const logger = require('./logger');

const API_URL = 'https://api.globalping.io/v1/measurements';
const DEFAULT_COUNTRY = 'IT';
const REQUEST_TIMEOUT = 5000;
const POLL_INTERVAL = 1000;
const MAX_WAIT = 12000;
const SUCCESS_CACHE_TTL = 10 * 60 * 1000;
const FAILURE_CACHE_TTL = 60 * 1000;
const PROBE_LIMIT = 3;
const PACKETS = 4;

const cache = new Map();

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const getProbeCountry = () => String(config.minecraft?.pingCountry ?? DEFAULT_COUNTRY).trim().toUpperCase() || null;

const describeCountry = (code) => {
    try {
        return new Intl.DisplayNames(['it'], { type: 'region' }).of(code) || code;
    } catch {
        return code;
    }
};

const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'bot.fw.music', ...options.headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
};

const runMeasurement = async ({ host, port, protocol, country, pollInterval, maxWait }) => {
    const measurementOptions = protocol === 'TCP'
        ? { protocol: 'TCP', port, packets: PACKETS }
        : { protocol: 'ICMP', packets: PACKETS };

    const created = await requestJson(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            type: 'ping',
            target: host,
            locations: [{ country }],
            limit: PROBE_LIMIT,
            measurementOptions
        })
    });

    if (!created?.id) throw new Error('measurement was not created');

    const deadline = Date.now() + maxWait;

    while (Date.now() < deadline) {
        await sleep(pollInterval);
        const measurement = await requestJson(`${API_URL}/${created.id}`);

        if (measurement.status === 'finished') {
            const averages = (measurement.results || [])
                .map(entry => entry.result?.stats?.avg)
                .filter(value => Number.isFinite(value));

            if (averages.length === 0) throw new Error('no probe could reach the target');

            return { latency: Math.round(median(averages) * 10) / 10, country, probes: averages.length };
        }
    }

    throw new Error('timed out waiting for the probes');
};

const measurePlayerPing = ({ host, port, protocol = 'TCP', country = getProbeCountry(), pollInterval = POLL_INTERVAL, maxWait = MAX_WAIT }) => {
    if (!country) return Promise.resolve({ error: 'DISABLED' });

    const key = `${protocol}:${host}:${port || ''}:${country}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < cached.ttl) return cached.promise;

    const entry = { at: Date.now(), ttl: SUCCESS_CACHE_TTL, promise: null };
    entry.promise = runMeasurement({ host, port, protocol, country, pollInterval, maxWait })
        .catch((error) => {
            entry.ttl = FAILURE_CACHE_TTL;
            return { error: error.message };
        });

    cache.set(key, entry);
    return entry.promise;
};

const logProbeFailure = (source, name, probe) => {
    if (!probe?.error || probe.error === 'DISABLED') return;
    logger.warn(`${source}: ${name} player ping unavailable: ${probe.error}.`);
};

module.exports = { measurePlayerPing, logProbeFailure, getProbeCountry, describeCountry };
