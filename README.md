# discord.fixed.js

A **minimal, fast, and opinionated framework** built on top of **discord.js v14** that removes boilerplate and provides powerful helper utilities for building Discord bots.

---

## Installation

```bash
npm install discord.fixed.js
```

---

## Quick Start

```js
// CommonJS
const { Bot, EmbedBuilder, Button } = require("discord.fixed.js");

// ESM
import { Bot, EmbedBuilder, Button } from "discord.fixed.js";

const client = new Bot({ intents: "all", owners: ["YOUR_USER_ID"] });
client.start("YOUR_BOT_TOKEN");
```

---

## Bot

```js
const client = new Bot({
  intents: "all",
  partials: "all",
  owners: ["YOUR_USER_ID"],
  prefix: "!",          // default: "!"
  plugins: []           // optional — see Plugin System below
});

await client.start("TOKEN");
```

### Methods

```js
// Check if user is an owner
client.isOwner(message.author.id); // true/false

// Get channel (cache-aware)
const channel = await client.getChannel("CHANNEL_ID");

// Wait for an event with optional filter + timeout
const msg = await client.waitFor("message", m => m.author.id === "USER_ID", 15000);
```

### Event Aliases

Use clean short names instead of discord.js camelCase events:

```js
client.on("message", msg => {});
client.on("interaction", i => {});
client.on("join", member => {});
client.once("ready", () => {});
```

| Alias | Discord.js Event |
|---|---|
| `message` | `messageCreate` |
| `join` | `guildMemberAdd` |
| `leave` | `guildMemberRemove` |
| `ban` | `guildBanAdd` |
| `unban` | `guildBanRemove` |
| `interaction` | `interactionCreate` |
| `reaction` | `messageReactionAdd` |
| `voiceUpdate` | `voiceStateUpdate` |
| `auditLog` | `guildAuditLogEntryCreate` |
| `guildJoin` | `guildCreate` |
| `guildLeave` | `guildDelete` |
| *(+ 80 more aliases)* | |

---

## Plugin System ✨ New in 2.0.1

The plugin system lets you extend your bot with reusable, npm-publishable modules. Plugins can register slash commands, prefix commands, scheduled tasks, middleware, and hook into any Discord event.

### Basic Usage

```js
const myPlugin = require("@discordfixedjs/my-plugin");
const { Bot } = require("discord.fixed.js");

const bot = new Bot({
  intents: "all",
  partials: "all",
  plugins: [myPlugin]
});

// Access the plugin instance
const plug = bot.plugin.myPlugin;
plug.doSomething();

bot.start("TOKEN");
```

### Plugin Contract

A plugin is a plain object (or npm package export) that follows this structure:

```js
module.exports = {
  // ── Required ────────────────────────────────────────────────
  name: "example",          // used as the key on bot.plugin.example

  // ── Lifecycle ────────────────────────────────────────────────
  init(bot) {},             // called immediately when the bot is constructed
  onReady() {},             // called when the bot goes online
  onDestroy() {},           // called when the bot shuts down

  // ── Message Hooks ────────────────────────────────────────────
  onMessage(msg) {},
  onMessageEdit(oldMsg, newMsg) {},
  onMessageDelete(msg) {},

  // ── Member Hooks ─────────────────────────────────────────────
  onMemberJoin(member) {},
  onMemberLeave(member) {},
  onMemberUpdate(oldMember, newMember) {},

  // ── Interaction Hooks ────────────────────────────────────────
  onInteraction(interaction) {},
  onSlashCommand(interaction) {},     // slash commands only
  onButton(interaction) {},           // button clicks only
  onSelectMenu(interaction) {},       // select menu only
  onModal(interaction) {},            // modal submits only

  // ── Middleware ───────────────────────────────────────────────
  // Return false to block the message from reaching other handlers
  messageMiddleware(msg) {},
  interactionMiddleware(interaction) {},

  // ── Slash Command Registration ────────────────────────────────
  // Auto-registered globally when the bot is ready
  commands: [
    {
      name: "ping",
      description: "Pings the bot",
      options: [],
      execute(interaction) {
        interaction.reply({ content: "Pong!" });
      }
    }
  ],

  // ── Prefix Command Registration ───────────────────────────────
  // Matched against bot.prefix (default: "!")
  prefixCommands: [
    {
      name: "hello",
      aliases: ["hi", "hey"],
      execute(msg, args) {
        msg.channel.send(`Hello, ${msg.author.username}!`);
      }
    }
  ],

  // ── Scheduled Tasks ───────────────────────────────────────────
  // Started on ready, stopped on destroy
  tasks: [
    {
      name: "status-update",
      interval: 60000,    // every 60 seconds
      execute(bot) {
        bot.user.setActivity("with plugins!");
      }
    }
  ],

  // ── Guild Hooks ──────────────────────────────────────────────
  onGuildJoin(guild) {},
  onGuildLeave(guild) {},

  // ── Voice Hooks ──────────────────────────────────────────────
  onVoiceUpdate(oldState, newState) {},

  // ── Role / Channel Hooks ─────────────────────────────────────
  onRoleCreate(role) {},
  onRoleDelete(role) {},
  onChannelCreate(channel) {},
  onChannelDelete(channel) {},

  // ── Error Hook ───────────────────────────────────────────────
  onError(error) {}
};
```

### Real-World Example — Automod Plugin

```js
// @discordfixedjs/automod
module.exports = {
  name: "automod",
  badWords: ["word1", "word2"],

  init(bot) {
    this.bot = bot;
    console.log("[automod] Loaded");
  },

  // Block messages containing bad words
  messageMiddleware(msg) {
    const found = this.badWords.some(w => msg.content.toLowerCase().includes(w));
    if (found) {
      msg.deleteSafe();
      msg.channel.send(`${msg.author}, watch your language!`);
      return false;   // stops further handling
    }
  },

  commands: [
    {
      name: "addword",
      description: "Add a word to the filter",
      options: [{ name: "word", description: "The word", type: 3, required: true }],
      execute(interaction) {
        const word = interaction.options.getString("word");
        this.badWords.push(word);
        interaction.ok(`Added "${word}" to the filter.`, true);
      }
    }
  ],

  tasks: [
    {
      name: "automod-log",
      interval: 3600000,   // every hour
      execute(bot) {
        console.log(`[automod] Filtering ${this.badWords.length} words`);
      }
    }
  ],

  onReady() {
    console.log("[automod] Active");
  }
};
```

### Using Multiple Plugins

```js
const logger  = require("@discordfixedjs/logger");
const automod = require("@discordfixedjs/automod");
const economy = require("@discordfixedjs/economy");

const bot = new Bot({
  intents: "all",
  partials: "all",
  prefix: "!",
  plugins: [logger, automod, economy]
});

bot.plugin.logger.log("Bot starting...");
bot.plugin.economy.addCoins(userId, 100);

bot.start("TOKEN");
```

### Plugin Isolation

Every plugin runs inside a try/catch. If one plugin throws an error, it is logged and the other plugins continue running normally — a broken plugin cannot crash your bot.

---

## Builders

### EmbedBuilder

```js
const embed = new EmbedBuilder()
  .title("Hello")
  .description("This is an embed")
  .color(Colors.blurple)
  .field("Name", "Value", true)
  .footer("Made with discord.fixed.js")
  .timestamp();
```

### Button / Row / Select

```js
const button = new Button()
  .label("Click Me")
  .style("green")
  .id("btn_1");

const row = new Row().add(button);

const select = new Select()
  .id("menu_1")
  .placeholder("Choose one")
  .min(1).max(1)
  .option("Option 1", "val_1");
```

### Modal Builder

```js
const modal = new Modal()
  .id("feedback_modal")
  .title("Give Feedback")
  .field("Your Name", "name", "short", { placeholder: "Enter your name", required: true })
  .field("Your Message", "message", "paragraph", { placeholder: "Type here...", max: 500 });

await interaction.showModal(modal);
```

---

## Interaction Sugar

Forget about checking `replied` or `deferred` manually — these methods handle it automatically:

```js
client.on("interaction", async (i) => {
  await i.ok("Done! ✅");                    // normal reply
  await i.ok("Done! ✅", true);              // ephemeral reply
  await i.fail("❌ Something went wrong!");   // always ephemeral
  await i.private("Only you can see this"); // always ephemeral
  await i.think();                          // defer reply (visible)
  await i.think(true);                      // defer reply (ephemeral)
  await i.refresh("Updated content");       // edit reply if already replied
});
```

---

## Timestamp Helper

```js
import { time } from "discord.fixed.js";

time(new Date(), "relative")  // → "2 hours ago"
time(new Date(), "short")     // → "9:41 PM"
time(new Date(), "long")      // → "9:41:30 PM"
time(new Date(), "date")      // → "01/01/2024"
time(new Date(), "longdate")  // → "January 1, 2024"
time(new Date(), "full")      // → "January 1, 2024 9:41 PM"
time(new Date(), "longfull")  // → "Friday, January 1, 2024 9:41 PM"
```

---

## Color Constants

```js
import { Colors } from "discord.fixed.js";

new EmbedBuilder().color(Colors.blurple);
new EmbedBuilder().color(Colors.red);
new EmbedBuilder().color(Colors.green);

// Available: blurple, white, black, dark, gray/grey,
// red, green, yellow, blue, orange, purple, pink,
// gold, teal, cyan, navy, transparent
```

---

## Cooldown Manager

```js
import { Cooldown } from "discord.fixed.js";

const cd = new Cooldown(5000); // 5 second cooldown

client.on("message", (msg) => {
  if (cd.check(msg.author.id)) {
    return msg.reply(`⏳ Wait ${cd.remainingText(msg.author.id)} before using this again.`);
  }
  cd.set(msg.author.id);
  // ... handle command
});

cd.remaining(userId);      // → ms remaining (number)
cd.remainingText(userId);  // → "4s" or "1m 30s"
cd.clear(userId);          // remove cooldown for user
cd.reset();                // clear ALL cooldowns
```

---

## Message Extensions

```js
message.reply("Hello!");
message.reply({ text: "Hey!", ping: true });
message.ping();
message.deleteSafe();
message.reactSafe("👍");
message.edit("New content");

message.collect({
  from: "USER_ID",
  time: 15000,
  onMessage: m => console.log(m.content),
  onEnd: collected => console.log(`Got ${collected.size} messages`)
});

const reply = await message.awaitReply(m => m.author.id === "USER_ID", 15000);
```

---

## User Extensions

```js
await user.dm("Hello!");
await user.dm({ content: "Hello!", embeds: [embed] });
```

---

## GuildMember Extensions

```js
if (member.hasRole("ROLE_ID")) {}
if (member.can("BanMembers")) {}

await member.addRole("ROLE_ID");
await member.removeRole("ROLE_ID", "reason");
await member.timeout(5, "Spamming");   // 5 minutes
await member.timeout(null);            // remove timeout
```

---

## Guild Extensions

```js
const member  = guild.findMember("Karan");
const role    = guild.findRole("Moderator");
const channel = guild.findChannel("general");
```

---

## Channel Sugar

```js
await channel.sendEmbed(embed);
await channel.sendEmbed([embed1, embed2]);
await channel.sendButtons("Choose an option:", row1, row2);
await channel.sendButtons({ content: "Pick:", embeds: [embed] }, row);
await channel.purge(10);
```

---

## VoiceChannelStatus

```js
await VoiceChannelStatus.set("🎮 Gaming", "CHANNEL_ID");
await VoiceChannelStatus.remove("CHANNEL_ID");

// Aliases
await VCS.set("🎧 Music", "CHANNEL_ID");
await VCStatus.remove("CHANNEL_ID");
```

---

## sendWebhook

```js
await sendWebhook("WEBHOOK_URL", "Hello!");
await sendWebhook("WEBHOOK_URL", { content: "Hello!", username: "My Bot", embeds: [embed] });
```

---

## File Structure

```
discord.fixed.js/
  index.js      ← CommonJS  (require)
  index.cjs     ← CommonJS  (explicit .cjs)
  index.mjs     ← ESM       (import)
  index.d.ts    ← TypeScript declarations
```

---

## How It Works

- Everything is in a **single file per format** — zero internal imports, zero path issues
- All patches are **auto-applied** the moment you require/import the library
- Plugins are **isolated in try/catch** — a broken plugin cannot crash your bot
- Slash commands from plugins are **auto-registered globally** when the bot goes ready
- Plugin tasks are **auto-started on ready** and **auto-cleared on destroy**
- Errors show a **full detailed log** with message + stack trace in the console

---

## Changelog

### 2.0.1
- Added full **Plugin System** — extend your bot with npm-publishable plugins
- Plugins support slash commands, prefix commands, scheduled tasks, middleware, and all Discord event hooks
- Added `prefix` option to `BotOptions`
- Added `bot.plugin` map for accessing loaded plugin instances
- Full TypeScript support for the plugin interface

### 2.0.0
- Initial release

---

## License

MIT License © 2026 discord.fixed.js
