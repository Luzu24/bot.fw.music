/**
 * Utility module for Minecraft server status pings, RCON response parsing and command building.
 */

const net = require('net');
const dgram = require('dgram');
const { Resolver } = require('dns').promises;
const config = require('../../config.json');

const DEFAULT_TIMEOUT = 3000;
const SRV_LOOKUP_TIMEOUT = 2000;
const HOSTNAME_PATTERN = /^[A-Za-z0-9.-]+$/;
const DEFAULT_JAVA_PORT = 25565;
const DEFAULT_BEDROCK_PORT = 19132;
const DEFAULT_BEDROCK_PREFIX = '.';
const JAVA_PROTOCOL_VERSION = 47;
const RAKNET_PONG_HEADER_LENGTH = 33;

const BEDROCK_PING_PACKET = Buffer.from([
    0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const stripFormatting = (text) => text.replace(/§[0-9a-fk-or]/gi, '');

const SMALL_CAPS = {
    'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i',
    'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ǫ': 'q', 'ʀ': 'r',
    'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z'
};
const SMALL_CAPS_PATTERN = new RegExp(`[${Object.keys(SMALL_CAPS).join('')}]`, 'g');
const OFFLINE_VERSION_PATTERN = /\boffline\b/;

const normalizeText = (text) => stripFormatting(text).replace(SMALL_CAPS_PATTERN, (char) => SMALL_CAPS[char]).toLowerCase();

const writeVarInt = (value) => {
    const bytes = [];
    let current = value >>> 0;

    do {
        let byte = current & 0x7f;
        current >>>= 7;
        if (current !== 0) byte |= 0x80;
        bytes.push(byte);
    } while (current !== 0);

    return Buffer.from(bytes);
};

const readVarInt = (buffer, offset = 0) => {
    let value = 0;
    let position = 0;
    let cursor = offset;

    while (true) {
        if (cursor >= buffer.length) return null;
        const byte = buffer[cursor++];
        value |= (byte & 0x7f) << position;
        if ((byte & 0x80) === 0) break;
        position += 7;
        if (position >= 35) throw new Error('VarInt is too long');
    }

    return { value, size: cursor - offset };
};

const writeString = (text) => Buffer.concat([writeVarInt(Buffer.byteLength(text)), Buffer.from(text, 'utf8')]);

const createPacket = (id, payload) => {
    const body = Buffer.concat([writeVarInt(id), payload]);
    return Buffer.concat([writeVarInt(body.length), body]);
};

const flattenChat = (component) => {
    if (typeof component === 'string') return component;
    if (Array.isArray(component)) return component.map(flattenChat).join('');
    if (!component || typeof component !== 'object') return '';
    return `${component.text || ''}${(component.extra || []).map(flattenChat).join('')}`;
};

const normalizeJavaStatus = (parsed) => ({
    players: {
        online: parsed.players?.online ?? 0,
        max: parsed.players?.max ?? 0,
        sample: (parsed.players?.sample || []).map(player => player.name)
    },
    version: stripFormatting(parsed.version?.name ?? '').trim() || null,
    motd: stripFormatting(flattenChat(parsed.description)).trim()
});

const isOfflinePlaceholder = (status) => status.players.max === 0 || OFFLINE_VERSION_PATTERN.test(normalizeText(status.version || ''));

const isValidHost = (host) => HOSTNAME_PATTERN.test(host);

const resolveJavaTarget = async (host, explicitPort) => {
    if (explicitPort || net.isIP(host)) {
        return { host, port: explicitPort || DEFAULT_JAVA_PORT };
    }

    try {
        const resolver = new Resolver({ timeout: SRV_LOOKUP_TIMEOUT, tries: 1 });
        const records = await resolver.resolveSrv(`_minecraft._tcp.${host}`);
        if (records.length > 0) {
            const [record] = [...records].sort((a, b) => a.priority - b.priority || b.weight - a.weight);
            return { host: record.name, port: record.port };
        }
    } catch { }

    return { host, port: DEFAULT_JAVA_PORT };
};

const pingJava = async ({ host, port, timeout } = {}) => {
    const configuredHost = String(host || config.minecraft.javaIp || '').trim();
    const timeoutMs = timeout || DEFAULT_TIMEOUT;

    if (!isValidHost(configuredHost)) {
        return { online: false, latency: null, target: configuredHost, error: 'NOT_CONFIGURED' };
    }

    const originalHost = String(host || config.minecraft.pingHost || configuredHost).trim();
    const explicitPort = port || parseInt(config.minecraft.javaPort, 10) || null;
    const { host: connectHost, port: connectPort } = await resolveJavaTarget(originalHost, explicitPort);
    const target = `${connectHost}:${connectPort}`;

    return new Promise((resolve) => {
        const socket = new net.Socket();
        let buffer = Buffer.alloc(0);
        let status = null;
        let startedAt = 0;
        let pingSentAt = 0;
        let statusLatency = null;
        let pongLatency = null;
        let settled = false;

        const finish = (failure) => {
            if (settled) return;
            settled = true;
            socket.destroy();

            if (!status) {
                resolve({ online: false, latency: null, target, error: failure || 'NO_RESPONSE' });
                return;
            }

            resolve({ online: true, latency: pongLatency ?? statusLatency, target, ...status });
        };

        const handlePacket = (packet) => {
            const id = readVarInt(packet);
            if (!id) return;

            if (id.value === 0x00 && !status) {
                const length = readVarInt(packet, id.size);
                if (!length) return;
                const start = id.size + length.size;
                const json = packet.subarray(start, start + length.value).toString('utf8');
                const parsedStatus = normalizeJavaStatus(JSON.parse(json));

                if (isOfflinePlaceholder(parsedStatus)) {
                    finish('SERVER_OFFLINE');
                    return;
                }

                status = parsedStatus;
                statusLatency = Date.now() - startedAt;

                const payload = Buffer.alloc(8);
                payload.writeBigInt64BE(BigInt(Date.now()));
                pingSentAt = Date.now();
                socket.write(createPacket(0x01, payload));
                return;
            }

            if (id.value === 0x01) {
                pongLatency = Date.now() - pingSentAt;
                finish();
            }
        };

        socket.setTimeout(timeoutMs);

        socket.connect({ port: connectPort, host: connectHost, family: 4 }, () => {
            const portBuffer = Buffer.alloc(2);
            portBuffer.writeUInt16BE(connectPort);

            const handshake = createPacket(0x00, Buffer.concat([
                writeVarInt(JAVA_PROTOCOL_VERSION),
                writeString(originalHost),
                portBuffer,
                writeVarInt(1)
            ]));

            startedAt = Date.now();
            socket.write(handshake);
            socket.write(createPacket(0x00, Buffer.alloc(0)));
        });

        socket.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);

            try {
                while (!settled) {
                    const length = readVarInt(buffer);
                    if (!length || buffer.length < length.size + length.value) break;

                    const packet = buffer.subarray(length.size, length.size + length.value);
                    buffer = buffer.subarray(length.size + length.value);
                    handlePacket(packet);
                }
            } catch {
                finish('INVALID_RESPONSE');
            }
        });

        socket.on('error', (error) => finish(error.code || 'ERROR'));
        socket.on('timeout', () => finish('TIMEOUT'));
        socket.on('close', () => finish());
    });
};

const parseBedrockPong = (message) => {
    try {
        const length = message.readUInt16BE(RAKNET_PONG_HEADER_LENGTH);
        const start = RAKNET_PONG_HEADER_LENGTH + 2;
        const fields = message.subarray(start, start + length).toString('utf8').split(';');

        return {
            motd: fields[1] || null,
            version: fields[3] || null,
            players: { online: parseInt(fields[4], 10) || 0, max: parseInt(fields[5], 10) || 0 }
        };
    } catch {
        return { motd: null, version: null, players: null };
    }
};

const pingBedrock = ({ host, port, timeout } = {}) => {
    const configuredHost = String(host || config.minecraft.bedrockIp || '').trim();
    const targetHost = String(host || config.minecraft.pingHost || configuredHost).trim();
    const targetPort = port || parseInt(config.minecraft.bedrockPort, 10) || DEFAULT_BEDROCK_PORT;
    const timeoutMs = timeout || DEFAULT_TIMEOUT;
    const target = `${targetHost}:${targetPort}`;

    if (!isValidHost(configuredHost)) {
        return Promise.resolve({ online: false, latency: null, target, error: 'NOT_CONFIGURED' });
    }

    return new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');
        const startedAt = Date.now();
        let timer = null;
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                socket.close();
            } catch { }
            resolve({ target, ...result });
        };

        timer = setTimeout(() => finish({ online: false, latency: null, error: 'TIMEOUT' }), timeoutMs);

        socket.on('message', (message) => {
            finish({ online: true, latency: Date.now() - startedAt, ...parseBedrockPong(message) });
        });

        socket.on('error', (error) => finish({ online: false, latency: null, error: error.code || 'ERROR' }));

        socket.send(BEDROCK_PING_PACKET, 0, BEDROCK_PING_PACKET.length, targetPort, targetHost, (error) => {
            if (error) finish({ online: false, latency: null, error: error.code || 'ERROR' });
        });
    });
};

const getBedrockPrefix = () => config.minecraft?.bedrockPrefix || DEFAULT_BEDROCK_PREFIX;

const getBanTarget = (username, platform) => (platform === 'Java' ? username : `${getBedrockPrefix()}${username}`);

const getWhitelistCommand = (action, username, platform) => (
    platform === 'Java' ? `whitelist ${action} ${username}` : `fwhitelist ${action} ${username}`
);

const parsePlayerList = (response) => {
    const match = /(\d+)\D+?(\d+)\s*players?\s*online[.:]?\s*([\s\S]*)/i.exec(stripFormatting(response || ''));
    if (!match) return null;

    return {
        online: parseInt(match[1], 10),
        max: parseInt(match[2], 10),
        players: match[3].split(',').map(name => name.trim()).filter(Boolean)
    };
};

const parseWhitelist = (response) => {
    const text = stripFormatting(response || '').trim();
    if (!text || /no whitelisted players/i.test(text)) return [];

    const separatorIndex = text.indexOf(':');
    if (separatorIndex === -1) return [];

    return text.slice(separatorIndex + 1).split(',').map(name => name.trim()).filter(Boolean);
};

module.exports = {
    pingJava,
    pingBedrock,
    getBanTarget,
    getWhitelistCommand,
    parsePlayerList,
    parseWhitelist
};