# bot.fw.music

Discord bot for Minecraft crossplay (Java + Bedrock) server management and community integration.

## Requirements

- Node.js 18 or newer
- A Minecraft server with RCON enabled
- Floodgate on the server, for Bedrock whitelist support (`/fwhitelist`)

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` and `RCON_PASSWORD`. `DATA_DIR` is optional (see Data).
3. Fill in `config.json` (see below).
4. Register the slash commands with `npm run deploy` (rerun it whenever a command is added or changed).
5. Start the bot with `npm start`, or `npm run dev` to restart on file changes.

## Configuration

`config.json` keys:

| Key | Description |
| --- | --- |
| `colors` | Embed colors (`primary`, `success`, `warning`, `error`) |
| `channels.welcome` | Channel where the welcome message is sent |
| `channels.botLogs` | Channel for bot logs (command usage, warnings, errors) |
| `channels.rconLogs` | Channel for RCON command logs |
| `roles.autoroles` | Roles given to every new member |
| `roles.whitelisted` | Role for whitelisted members |
| `roles.unwhitelisted` | Role for members not (or no longer) whitelisted |
| `roles.blacklisted` | Role for blacklisted members |
| `roles.admin` | Role allowed to use the admin commands |
| `minecraft.javaIp` | Java server address shown to players |
| `minecraft.javaPort` | Optional. If omitted, the `_minecraft._tcp.<javaIp>` SRV record is used for status checks, then `25565` |
| `minecraft.pingHost` | Optional host used only for status checks, for when the public address is not reachable from the bot's machine |
| `minecraft.bedrockIp` | Bedrock server address shown to players. If it is not a valid host name (for example a placeholder text), Bedrock checks are skipped |
| `minecraft.bedrockPort` | Bedrock server port, defaults to `19132` |
| `minecraft.bedrockPrefix` | Optional Floodgate username prefix, defaults to `.` |
| `rcon.host`, `rcon.port` | RCON connection |

## Commands

General:

| Command | Description |
| --- | --- |
| `/help` | Lists the commands available to the user |
| `/ip` | Shows the connection addresses |
| `/ping` | Shows bot latency and server latency |
| `/status` | Shows server status, players and version |
| `/players` | Shows the players currently online |

Admin:

| Command | Description |
| --- | --- |
| `/whitelist` | Adds a user to the whitelist and sets their Discord nickname to their Minecraft username (platform is detected, or set with `piattaforma`) |
| `/unwhitelist` | Removes a user from the whitelist |
| `/whitelistlist` | Lists whitelisted users |
| `/whitelistsync` | Compares the bot database with the server whitelist |
| `/syncnick` | Sets the nickname of whitelisted users to their Minecraft username (all users, or one with `discord`) |
| `/blacklist` | Unwhitelists, bans and marks a user as blacklisted |
| `/unblacklist` | Unbans a user and removes them from the blacklist |
| `/blacklistlist` | Lists blacklisted users |
| `/whois` | Finds the Minecraft account of a Discord user, or the reverse |

## Data

Runtime data is stored in `src/data/` (or in the folder set by `DATA_DIR`) and is not versioned. It is the only place where the Discord and Minecraft accounts are linked, so keep it on persistent storage and copy it along when moving the bot to a new host:

- `whitelisted.json` maps a Discord ID to a Minecraft `username` and `platform`
- `blacklisted.json` maps a Discord ID to a Minecraft `username`, `platform`, `blacklistedBy` and `blacklistedAt`

The first change of each day also saves a copy of the previous state in `backups/` inside the data folder (the latest 14 days are kept). A file that is not valid JSON is copied aside as `*.corrupt-<timestamp>` before it can be overwritten.

Members who leave the Discord server are removed from the Minecraft whitelist automatically.
Blacklisted members who rejoin only receive the blacklisted role.
