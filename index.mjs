import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Message,
  MessageFlags,
  EmbedBuilder as DjsEmbedBuilder,
  ButtonBuilder as DjsButtonBuilder,
  ActionRowBuilder as DjsActionRowBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  PermissionFlagsBits,
  ChannelType,
  ComponentType,
  TextInputStyle,
  InteractionType,
  WebhookClient,
  User,
  GuildMember,
  Guild,
  BaseGuildTextChannel,
  BaseInteraction,
  ModalBuilder as DjsModalBuilder,
  TextInputBuilder
} from 'discord.js';

let _client = null;

function _throwErr(title, err, fatal = false) {
  const line = '─'.repeat(55);
  console.error(`\n${line}`);
  console.error(`  [discord.fixed.js] ❌  ${title}`);
  console.error(line);
  if (err instanceof Error) {
    console.error(`  Message : ${err.message}`);
    if (err.stack) {
      console.error(`  Stack   :`);
      err.stack.split('\n').slice(1).forEach(l => console.error(`    ${l.trim()}`));
    }
  } else {
    console.error(`  Details : ${err}`);
  }
  console.error(`${line}\n`);
  if (fatal) throw new Error(`[discord.fixed.js] ${title}: ${err instanceof Error ? err.message : err}`);
}

const EVENT_ALIASES = {
  message: 'messageCreate', messageDelete: 'messageDelete', messageUpdate: 'messageUpdate',
  messageBulkDelete: 'messageDeleteBulk', messagePin: 'channelPinsUpdate',
  reaction: 'messageReactionAdd', reactionRemove: 'messageReactionRemove',
  reactionRemoveAll: 'messageReactionRemoveAll', reactionRemoveEmoji: 'messageReactionRemoveEmoji',
  pollVoteAdd: 'messagePollVoteAdd', pollVoteRemove: 'messagePollVoteRemove',
  join: 'guildMemberAdd', leave: 'guildMemberRemove', memberUpdate: 'guildMemberUpdate',
  memberAvailable: 'guildMemberAvailable', membersChunk: 'guildMembersChunk',
  ban: 'guildBanAdd', unban: 'guildBanRemove', guildJoin: 'guildCreate', guildLeave: 'guildDelete',
  guildUpdate: 'guildUpdate', guildAvailable: 'guildAvailable', guildUnavailable: 'guildUnavailable',
  auditLog: 'guildAuditLogEntryCreate', roleCreate: 'roleCreate', roleDelete: 'roleDelete',
  roleUpdate: 'roleUpdate', channelCreate: 'channelCreate', channelDelete: 'channelDelete',
  channelUpdate: 'channelUpdate', interaction: 'interactionCreate', voiceUpdate: 'voiceStateUpdate',
  voiceServer: 'voiceServerUpdate', voiceEffect: 'voiceChannelEffectSend', typing: 'typingStart',
  presence: 'presenceUpdate', userUpdate: 'userUpdate', webhooks: 'webhooksUpdate',
  inviteCreate: 'inviteCreate', inviteDelete: 'inviteDelete', threadCreate: 'threadCreate',
  threadDelete: 'threadDelete', threadUpdate: 'threadUpdate', threadMemberUpdate: 'threadMemberUpdate',
  threadMembersUpdate: 'threadMembersUpdate', threadListSync: 'threadListSync',
  stageCreate: 'stageInstanceCreate', stageDelete: 'stageInstanceDelete', stageUpdate: 'stageInstanceUpdate',
  automodAction: 'autoModerationActionExecution', automodCreate: 'autoModerationRuleCreate',
  automodDelete: 'autoModerationRuleDelete', automodUpdate: 'autoModerationRuleUpdate',
  emojiCreate: 'emojiCreate', emojiDelete: 'emojiDelete', emojiUpdate: 'emojiUpdate',
  stickerCreate: 'stickerCreate', stickerDelete: 'stickerDelete', stickerUpdate: 'stickerUpdate',
  scheduledCreate: 'guildScheduledEventCreate', scheduledDelete: 'guildScheduledEventDelete',
  scheduledUpdate: 'guildScheduledEventUpdate', scheduledUserAdd: 'guildScheduledEventUserAdd',
  scheduledUserRemove: 'guildScheduledEventUserRemove', soundCreate: 'guildSoundboardSoundCreate',
  soundDelete: 'guildSoundboardSoundDelete', soundUpdate: 'guildSoundboardSoundUpdate',
  subscriptionCreate: 'subscriptionCreate', subscriptionDelete: 'subscriptionDelete',
  subscriptionUpdate: 'subscriptionUpdate', ready: 'ready', clientReady: 'clientReady',
  shardReady: 'shardReady', shardDisconnect: 'shardDisconnect', shardError: 'shardError',
  shardReconnect: 'shardReconnecting', shardResume: 'shardResume',
  error: 'error', warn: 'warn', debug: 'debug', raw: 'raw'
};

// ─────────────────────────────────────────────
//  Plugin System
// ─────────────────────────────────────────────
function _safePluginCall(plugin, method, ...args) {
  try {
    if (typeof plugin[method] === 'function') plugin[method](...args);
  } catch (err) {
    _throwErr(`Plugin[${plugin.name}]#${method}`, err);
  }
}

function _loadPlugins(bot, plugins) {
  for (const raw of plugins) {
    if (!raw || typeof raw.name !== 'string') {
      _throwErr('Plugin', new Error('Every plugin must export a "name" string field.'));
      continue;
    }
    const plugin = Object.assign(Object.create(null), raw);
    try {
      if (typeof plugin.init === 'function') plugin.init(bot);
    } catch (err) {
      _throwErr(`Plugin[${plugin.name}]#init`, err);
      continue;
    }
    bot.plugin[plugin.name] = plugin;
    if (Array.isArray(plugin.commands))      for (const cmd  of plugin.commands)      bot._pluginSlashCommands.push({ plugin, cmd });
    if (Array.isArray(plugin.prefixCommands)) for (const cmd  of plugin.prefixCommands) bot._pluginPrefixCommands.push({ plugin, cmd });
    if (Array.isArray(plugin.tasks))          for (const task of plugin.tasks)          bot._pluginTasks.push({ plugin, task });
  }
  _wirePluginEvents(bot);
}

function _wirePluginEvents(bot) {
  const pluginList = () => Object.values(bot.plugin);

  Client.prototype.on.call(bot, 'clientReady', async () => {
    if (bot._pluginSlashCommands.length > 0) {
      try {
        const body = bot._pluginSlashCommands.map(({ cmd }) => ({ name: cmd.name, description: cmd.description, options: cmd.options || [] }));
        await bot.rest.put(Routes.applicationCommands(bot.user.id), { body });
      } catch (err) { _throwErr('Plugin slash command registration', err); }
    }
    for (const { plugin, task } of bot._pluginTasks) {
      task._intervalId = setInterval(() => {
        try { task.execute.call(plugin, bot); }
        catch (err) { _throwErr(`Plugin[${plugin.name}] task[${task.name}]`, err); }
      }, task.interval);
    }
    for (const p of pluginList()) _safePluginCall(p, 'onReady');
  });

  Client.prototype.on.call(bot, 'messageCreate', (msg) => {
    for (const p of pluginList()) {
      if (typeof p.messageMiddleware === 'function') {
        try { if (p.messageMiddleware(msg) === false) return; }
        catch (err) { _throwErr(`Plugin[${p.name}]#messageMiddleware`, err); }
      }
    }
    if (bot._pluginPrefixCommands.length > 0 && msg.content) {
      const prefix = bot.prefix || '!';
      for (const { plugin, cmd } of bot._pluginPrefixCommands) {
        for (const trigger of [cmd.name, ...(cmd.aliases || [])]) {
          const full = (prefix + trigger).toLowerCase();
          if (msg.content.toLowerCase().startsWith(full)) {
            const args = msg.content.slice(full.length).trim().split(/\s+/).filter(Boolean);
            try { cmd.execute.call(plugin, msg, args); } catch (err) { _throwErr(`Plugin[${plugin.name}] prefixCommand[${cmd.name}]`, err); }
            return;
          }
        }
      }
    }
    for (const p of pluginList()) _safePluginCall(p, 'onMessage', msg);
  });

  Client.prototype.on.call(bot, 'messageUpdate', (o, n) => { for (const p of pluginList()) _safePluginCall(p, 'onMessageEdit', o, n); });
  Client.prototype.on.call(bot, 'messageDelete', (msg)  => { for (const p of pluginList()) _safePluginCall(p, 'onMessageDelete', msg); });

  Client.prototype.on.call(bot, 'guildMemberAdd',    (m)    => { for (const p of pluginList()) _safePluginCall(p, 'onMemberJoin', m); });
  Client.prototype.on.call(bot, 'guildMemberRemove', (m)    => { for (const p of pluginList()) _safePluginCall(p, 'onMemberLeave', m); });
  Client.prototype.on.call(bot, 'guildMemberUpdate', (o, n) => { for (const p of pluginList()) _safePluginCall(p, 'onMemberUpdate', o, n); });

  Client.prototype.on.call(bot, 'interactionCreate', (interaction) => {
    for (const p of pluginList()) {
      if (typeof p.interactionMiddleware === 'function') {
        try { if (p.interactionMiddleware(interaction) === false) return; }
        catch (err) { _throwErr(`Plugin[${p.name}]#interactionMiddleware`, err); }
      }
    }
    if (interaction.isChatInputCommand()) {
      for (const { plugin, cmd } of bot._pluginSlashCommands) {
        if (cmd.name === interaction.commandName) {
          try { cmd.execute.call(plugin, interaction); } catch (err) { _throwErr(`Plugin[${plugin.name}] command[${cmd.name}]`, err); }
        }
      }
    }
    for (const p of pluginList()) {
      _safePluginCall(p, 'onInteraction', interaction);
      if (interaction.isChatInputCommand()) _safePluginCall(p, 'onSlashCommand', interaction);
      if (interaction.isButton())           _safePluginCall(p, 'onButton', interaction);
      if (interaction.isStringSelectMenu()) _safePluginCall(p, 'onSelectMenu', interaction);
      if (interaction.isModalSubmit())      _safePluginCall(p, 'onModal', interaction);
    }
  });

  Client.prototype.on.call(bot, 'guildCreate',    (g) => { for (const p of pluginList()) _safePluginCall(p, 'onGuildJoin', g); });
  Client.prototype.on.call(bot, 'guildDelete',    (g) => { for (const p of pluginList()) _safePluginCall(p, 'onGuildLeave', g); });
  Client.prototype.on.call(bot, 'voiceStateUpdate', (o, n) => { for (const p of pluginList()) _safePluginCall(p, 'onVoiceUpdate', o, n); });
  Client.prototype.on.call(bot, 'roleCreate',    (r) => { for (const p of pluginList()) _safePluginCall(p, 'onRoleCreate', r); });
  Client.prototype.on.call(bot, 'roleDelete',    (r) => { for (const p of pluginList()) _safePluginCall(p, 'onRoleDelete', r); });
  Client.prototype.on.call(bot, 'channelCreate', (c) => { for (const p of pluginList()) _safePluginCall(p, 'onChannelCreate', c); });
  Client.prototype.on.call(bot, 'channelDelete', (c) => { for (const p of pluginList()) _safePluginCall(p, 'onChannelDelete', c); });
  Client.prototype.on.call(bot, 'error',   (e) => { for (const p of pluginList()) _safePluginCall(p, 'onError', e); });
  Client.prototype.once.call(bot, 'destroy', () => {
    for (const { task } of bot._pluginTasks) { if (task._intervalId) clearInterval(task._intervalId); }
    for (const p of pluginList()) _safePluginCall(p, 'onDestroy');
  });
}

class Bot extends Client {
  constructor(options = {}) {
    const intents = options.intents === 'all' ? Object.values(GatewayIntentBits) : options.intents;
    const partials = options.partials === 'all' ? Object.values(Partials) : options.partials;
    const allowedMentions = options.allowedMentions || { parse: ['users', 'roles', 'everyone'], repliedUser: true };
    super({ intents, partials, allowedMentions });
    this.owners = options.owners || [];
    this.prefix = options.prefix || '!';

    this.plugin               = {};
    this._pluginTasks         = [];
    this._pluginPrefixCommands = [];
    this._pluginSlashCommands  = [];

    if (Array.isArray(options.plugins) && options.plugins.length > 0) {
      _loadPlugins(this, options.plugins);
    }
  }
  async start(token) {
    try { this.rest = new REST({ version: '10' }).setToken(token); _client = this; await this.login(token); }
    catch (err) { _throwErr('Bot#start', err, true); }
  }
  isOwner(userId) { return this.owners.includes(String(userId)); }
  async getChannel(id) {
    try { return this.channels.cache.get(id) ?? await this.channels.fetch(id); }
    catch (err) { _throwErr('Bot#getChannel', err); return null; }
  }
  on(event, listener) { return super.on(EVENT_ALIASES[event] ?? event, listener); }
  once(event, listener) { return super.once(EVENT_ALIASES[event] ?? event, listener); }
  waitFor(event, filter = () => true, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`[discord.fixed.js] waitFor timed out on "${event}"`)), timeout);
      const handler = (...args) => { if (!filter(...args)) return; clearTimeout(timer); super.off(EVENT_ALIASES[event] ?? event, handler); resolve(args.length === 1 ? args[0] : args); };
      super.on(EVENT_ALIASES[event] ?? event, handler);
    });
  }
}

Message.prototype.reply = function (data) {
  if (typeof data === 'string') return this.channel.send({ content: data, flags: MessageFlags.SuppressNotifications });
  const { text, ping = false, ...rest } = data;
  return this.channel.send({ content: text, allowedMentions: ping ? undefined : { users: [] }, flags: ping ? undefined : MessageFlags.SuppressNotifications, ...rest });
};
Message.prototype.edit = (function() { const orig = Message.prototype.edit; return function(data) { return orig.call(this, typeof data === 'string' ? { content: data } : data); }; })();
Message.prototype.deleteSafe = function () { if (this.deletable) return this.delete(); };
Message.prototype.reactSafe = function (emoji) { if (this.reactable) return this.react(emoji); };
Message.prototype.ping = function () { return this.reply({ text: `<@${this.author.id}>`, ping: true }); };
Message.prototype.collect = function ({ from, time = 30000, filter, onMessage, onEnd } = {}) {
  const resolvedFilter = filter ?? (from ? (m => m.author.id === from) : () => true);
  const collector = this.channel.createMessageCollector({ filter: resolvedFilter, time });
  if (onMessage) collector.on('collect', onMessage);
  if (onEnd) collector.on('end', onEnd);
  return collector;
};
Message.prototype.awaitReply = function (filter = () => true, time = 30000) {
  return this.channel.awaitMessages({ filter, max: 1, time, errors: ['time'] }).then(c => c.first());
};

User.prototype.dm = function (data) {
  return this.createDM().then(ch => ch.send(typeof data === 'string' ? { content: data } : data)).catch(err => _throwErr('user.dm', err));
};

GuildMember.prototype.hasRole = function (roleId) { return this.roles.cache.has(roleId); };
GuildMember.prototype.can = function (perm) {
  try {
    const bit = typeof perm === 'string' ? (PermissionFlagsBits[perm] ?? PermissionFlagsBits[perm.charAt(0).toUpperCase() + perm.slice(1)]) : perm;
    if (!bit) _throwErr('member.can', new Error(`Unknown permission: "${perm}"`));
    return this.permissions.has(bit);
  } catch (err) { _throwErr('member.can', err); return false; }
};
GuildMember.prototype.addRole = function (roleId, reason) { return this.roles.add(roleId, reason).catch(err => _throwErr('member.addRole', err)); };
GuildMember.prototype.removeRole = function (roleId, reason) { return this.roles.remove(roleId, reason).catch(err => _throwErr('member.removeRole', err)); };
GuildMember.prototype.timeout = function (minutes, reason) { return this.disableCommunicationUntil(minutes ? Date.now() + minutes * 60_000 : null, reason).catch(err => _throwErr('member.timeout', err)); };

Guild.prototype.findMember = function (query) {
  if (!query) return null; const q = String(query).toLowerCase();
  return this.members.cache.get(query) ?? this.members.cache.find(m => m.user.username.toLowerCase() === q || m.nickname?.toLowerCase() === q || m.displayName.toLowerCase() === q) ?? null;
};
Guild.prototype.findRole = function (query) {
  if (!query) return null; const q = String(query).toLowerCase();
  return this.roles.cache.get(query) ?? this.roles.cache.find(r => r.name.toLowerCase() === q) ?? null;
};
Guild.prototype.findChannel = function (query) {
  if (!query) return null; const q = String(query).toLowerCase();
  return this.channels.cache.get(query) ?? this.channels.cache.find(c => c.name?.toLowerCase() === q) ?? null;
};

BaseGuildTextChannel.prototype.purge = function (amount = 10) { return this.bulkDelete(amount, true).catch(err => _throwErr('channel.purge', err)); };
BaseGuildTextChannel.prototype.sendEmbed = function (embed) {
  try { return this.send({ embeds: Array.isArray(embed) ? embed : [embed] }); } catch (err) { _throwErr('channel.sendEmbed', err); }
};
BaseGuildTextChannel.prototype.sendButtons = function (content, ...rows) {
  try { const payload = typeof content === 'string' ? { content } : { ...content }; payload.components = rows; return this.send(payload); } catch (err) { _throwErr('channel.sendButtons', err); }
};

BaseInteraction.prototype.ok = function (data, ephemeral = false) {
  try { const p = typeof data === 'string' ? { content: data } : { ...data }; if (ephemeral) p.flags = MessageFlags.Ephemeral; return (this.replied || this.deferred) ? this.editReply(p) : this.reply(p); } catch (err) { _throwErr('interaction.ok', err); }
};
BaseInteraction.prototype.fail = function (data) {
  try { const p = typeof data === 'string' ? { content: data } : { ...data }; p.flags = MessageFlags.Ephemeral; return (this.replied || this.deferred) ? this.editReply(p) : this.reply(p); } catch (err) { _throwErr('interaction.fail', err); }
};
BaseInteraction.prototype.private = function (data) {
  try { const p = typeof data === 'string' ? { content: data } : { ...data }; p.flags = MessageFlags.Ephemeral; return (this.replied || this.deferred) ? this.editReply(p) : this.reply(p); } catch (err) { _throwErr('interaction.private', err); }
};
BaseInteraction.prototype.think = function (ephemeral = false) { return this.deferReply({ ephemeral }).catch(err => _throwErr('interaction.think', err)); };
BaseInteraction.prototype.refresh = function (data) {
  try { const p = typeof data === 'string' ? { content: data } : { ...data }; return (this.replied || this.deferred) ? this.editReply(p) : this.reply(p); } catch (err) { _throwErr('interaction.refresh', err); }
};

class EmbedBuilder extends DjsEmbedBuilder {
  constructor(data) { super(data); }
  title(v) { this.setTitle(String(v)); return this; }
  addTitle(v) { this.setTitle(String(v)); return this; }
  description(v) { this.setDescription(String(v)); return this; }
  addDescription(v) { this.setDescription(String(v)); return this; }
  color(v) { this.setColor(v); return this; }
  addColor(v) { this.setColor(v); return this; }
  thumbnail(url) { this.setThumbnail(url); return this; }
  addThumbnail(url) { this.setThumbnail(url); return this; }
  image(url) { this.setImage(url); return this; }
  addImage(url) { this.setImage(url); return this; }
  author(name, iconURL, url) { this.setAuthor({ name, iconURL, url }); return this; }
  addAuthor(name, iconURL, url) { this.setAuthor({ name, iconURL, url }); return this; }
  footer(text, iconURL) { this.setFooter({ text, iconURL }); return this; }
  addFooter(text, iconURL) { this.setFooter({ text, iconURL }); return this; }
  field(name, value, inline = false) { this.addFields({ name: String(name), value: String(value), inline }); return this; }
  addField(name, value, inline = false) { this.addFields({ name: String(name), value: String(value), inline }); return this; }
  fields(arr = []) { this.addFields(arr.map(f => ({ name: String(f.name), value: String(f.value), inline: Boolean(f.inline) }))); return this; }
  timestamp(v = Date.now()) { this.setTimestamp(v); return this; }
  addTime(v = Date.now()) { this.setTimestamp(v); return this; }
}

const STYLE_MAP = { blue: ButtonStyle.Primary, primary: ButtonStyle.Primary, green: ButtonStyle.Success, success: ButtonStyle.Success, red: ButtonStyle.Danger, danger: ButtonStyle.Danger, gray: ButtonStyle.Secondary, grey: ButtonStyle.Secondary, secondary: ButtonStyle.Secondary, link: ButtonStyle.Link };

class Button extends DjsButtonBuilder {
  constructor(data) { super(data); }
  label(v) { this.setLabel(String(v)); return this; }
  id(v) { this.setCustomId(String(v)); return this; }
  url(v) { this.setURL(String(v)); return this; }
  emoji(v) { this.setEmoji(v); return this; }
  disabled(v = true) { this.setDisabled(v); return this; }
  style(v) { if (typeof v === 'string') this.setStyle(STYLE_MAP[v.toLowerCase()] ?? ButtonStyle[v]); else this.setStyle(v); return this; }
}

class Row extends DjsActionRowBuilder {
  constructor(data) { super(data); }
  add(component) { this.addComponents(component); return this; }
  components(arr = []) { this.addComponents(arr); return this; }
}

class Select extends StringSelectMenuBuilder {
  id(i) { return super.setCustomId(i); }
  placeholder(t) { return super.setPlaceholder(t); }
  min(v) { return super.setMinValues(v); }
  max(v) { return super.setMaxValues(v); }
  option(l, v, d, e) { return super.addOptions({ label: l, value: v, description: d, emoji: e }); }
}

const INPUT_STYLE_MAP = { short: TextInputStyle.Short, paragraph: TextInputStyle.Paragraph, long: TextInputStyle.Paragraph };

class Modal extends DjsModalBuilder {
  constructor() { super(); }
  id(v) { this.setCustomId(String(v)); return this; }
  title(v) { this.setTitle(String(v)); return this; }
  field(label, id, style = 'short', options = {}) {
    try {
      const input = new TextInputBuilder().setCustomId(String(id)).setLabel(String(label)).setStyle(INPUT_STYLE_MAP[style.toLowerCase()] ?? TextInputStyle.Short);
      if (options.placeholder) input.setPlaceholder(options.placeholder);
      if (options.required !== undefined) input.setRequired(options.required);
      if (options.min !== undefined) input.setMinLength(options.min);
      if (options.max !== undefined) input.setMaxLength(options.max);
      if (options.value !== undefined) input.setValue(options.value);
      this.addComponents(new DjsActionRowBuilder().addComponents(input));
      return this;
    } catch (err) { _throwErr('Modal#field', err); return this; }
  }
}

class ComponentBuilder extends ContainerBuilder {
  constructor() { super(); }
  addText(input) { this.addTextDisplayComponents(typeof input === 'string' ? new TextDisplayBuilder().setContent(input) : input); return this; }
  addSeparator(spacing = 'Small') { const map = { Small: SeparatorSpacingSize.Small, Large: SeparatorSpacingSize.Large }; this.addSeparatorComponents(new SeparatorBuilder().setSpacing(map[spacing] ?? SeparatorSpacingSize.Small)); return this; }
  addButtons(...buttons) { this.addActionRowComponents(new DjsActionRowBuilder().addComponents(buttons)); return this; }
  addSelect(select) { this.addActionRowComponents(new DjsActionRowBuilder().addComponents(select)); return this; }
  addMedia(items = []) { const gallery = new MediaGalleryBuilder(); for (const item of items) gallery.addItems(typeof item === 'string' ? new MediaGalleryItemBuilder().setURL(item) : item); this.addMediaGalleryComponents(gallery); return this; }
}

const text = content => new TextDisplayBuilder().setContent(content);

class VoiceChannelStatus {
  static async set(statusText, id) { await _setStatus(statusText, id); }
  static async remove(id) { await _setStatus(null, id); }
}

async function _setStatus(statusText, id) {
  if (!_client) return _throwErr('VoiceChannelStatus', new Error('Bot#start() has not been called yet.'));
  try {
    const channel = await _client.channels.fetch(id);
    if (!channel) return _throwErr('VoiceChannelStatus', new Error(`Invalid channel ID: "${id}"`));
    if (channel.type !== ChannelType.GuildVoice) return _throwErr('VoiceChannelStatus', new Error(`Channel "${id}" is not a voice channel.`));
    await _client.rest.put(`/channels/${channel.id}/voice-status`, { body: { text: statusText } });
  } catch (err) { _throwErr('VoiceChannelStatus', err); }
}

async function sendWebhook(url, data) {
  try { const client = new WebhookClient({ url }); return await client.send(typeof data === 'string' ? { content: data } : data); }
  catch (err) { _throwErr('sendWebhook', err); }
}

const TIME_STYLES = { short: 't', long: 'T', date: 'd', longdate: 'D', full: 'f', longfull: 'F', relative: 'R' };
function time(date, style = 'relative') {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return _throwErr('time()', new Error(`Invalid date value: "${date}"`)) || '';
    return `<t:${Math.floor(d.getTime() / 1000)}:${TIME_STYLES[style] ?? style}>`;
  } catch (err) { _throwErr('time()', err); return ''; }
}

const Colors = { blurple: '#5865F2', white: '#FFFFFF', black: '#23272A', dark: '#2B2D31', gray: '#95A5A6', grey: '#95A5A6', red: '#ED4245', green: '#57F287', yellow: '#FEE75C', blue: '#3498DB', orange: '#E67E22', purple: '#9B59B6', pink: '#EB459E', gold: '#F1C40F', teal: '#1ABC9C', cyan: '#1ABCF2', navy: '#34495E', transparent: '#2B2D31' };

class Cooldown {
  constructor(ms) {
    if (typeof ms !== 'number' || ms <= 0) _throwErr('Cooldown', new Error(`Invalid duration: "${ms}". Must be a positive number (ms).`), true);
    this._ms = ms; this._map = new Map();
  }
  check(id) { const exp = this._map.get(String(id)); if (!exp) return false; if (Date.now() < exp) return true; this._map.delete(String(id)); return false; }
  set(id) { this._map.set(String(id), Date.now() + this._ms); }
  clear(id) { this._map.delete(String(id)); }
  remaining(id) { const exp = this._map.get(String(id)); if (!exp) return 0; const left = exp - Date.now(); return left > 0 ? left : 0; }
  remainingText(id) { const ms = this.remaining(id); if (!ms) return '0s'; const s = Math.ceil(ms / 1000); if (s < 60) return `${s}s`; const m = Math.floor(s / 60); const rem = s % 60; return rem ? `${m}m ${rem}s` : `${m}m`; }
  reset() { this._map.clear(); }
}

MessageFlags.V2 = MessageFlags.IsComponentsV2;

const I = GatewayIntentBits, Intents = GatewayIntentBits, IntentBits = GatewayIntentBits;
const Flags = MessageFlags, MessageFlag = MessageFlags, MsgFlags = MessageFlags;
const Perms = PermissionFlagsBits, Permissions = PermissionFlagsBits, PermissionBits = PermissionFlagsBits;
const Channels = ChannelType, ChannelTypes = ChannelType;
const Components = ComponentType, ComponentTypes = ComponentType;
const Buttons = ButtonStyle, ButtonStyles = ButtonStyle;
const Inputs = TextInputStyle, InputStyles = TextInputStyle;
const Interactions = InteractionType, InteractionTypes = InteractionType;
const WebClient = WebhookClient, Web = WebhookClient, Webhook = WebhookClient, WebhookClientClass = WebhookClient;

export {
  Bot,
  EmbedBuilder, EmbedBuilder as Embed,
  Button, Row, Select, Modal,
  ComponentBuilder, text, TextDisplayBuilder, SeparatorBuilder,
  DjsActionRowBuilder as ActionRowBuilder, DjsButtonBuilder as ButtonBuilder,
  StringSelectMenuBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  VoiceChannelStatus, VoiceChannelStatus as VCS, VoiceChannelStatus as VCStatus,
  sendWebhook, time, Colors, Cooldown,
  I, Intents, IntentBits,
  Flags, MessageFlag, MsgFlags,
  Perms, Permissions, PermissionBits,
  Channels, ChannelTypes,
  Components, ComponentTypes,
  Buttons, ButtonStyles,
  Inputs, InputStyles,
  Interactions, InteractionTypes,
  WebClient, Web, Webhook, WebhookClient, WebhookClientClass
};
