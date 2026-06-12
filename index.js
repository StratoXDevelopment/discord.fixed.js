'use strict';

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Message,
  MessageFlags,
  EmbedBuilder: DjsEmbedBuilder,
  ButtonBuilder: DjsButtonBuilder,
  ActionRowBuilder: DjsActionRowBuilder,
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
  ModalBuilder: DjsModalBuilder,
  TextInputBuilder
} = require('discord.js');

let _client = null;

// ─────────────────────────────────────────────
//  Error Logger
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  Event Aliases
// ─────────────────────────────────────────────
const EVENT_ALIASES = {
  message:                    'messageCreate',
  messageDelete:              'messageDelete',
  messageUpdate:              'messageUpdate',
  messageBulkDelete:          'messageDeleteBulk',
  messagePin:                 'channelPinsUpdate',
  reaction:                   'messageReactionAdd',
  reactionRemove:             'messageReactionRemove',
  reactionRemoveAll:          'messageReactionRemoveAll',
  reactionRemoveEmoji:        'messageReactionRemoveEmoji',
  pollVoteAdd:                'messagePollVoteAdd',
  pollVoteRemove:             'messagePollVoteRemove',
  join:                       'guildMemberAdd',
  leave:                      'guildMemberRemove',
  memberUpdate:               'guildMemberUpdate',
  memberAvailable:            'guildMemberAvailable',
  membersChunk:               'guildMembersChunk',
  ban:                        'guildBanAdd',
  unban:                      'guildBanRemove',
  guildJoin:                  'guildCreate',
  guildLeave:                 'guildDelete',
  guildUpdate:                'guildUpdate',
  guildAvailable:             'guildAvailable',
  guildUnavailable:           'guildUnavailable',
  auditLog:                   'guildAuditLogEntryCreate',
  roleCreate:                 'roleCreate',
  roleDelete:                 'roleDelete',
  roleUpdate:                 'roleUpdate',
  channelCreate:              'channelCreate',
  channelDelete:              'channelDelete',
  channelUpdate:              'channelUpdate',
  interaction:                'interactionCreate',
  voiceUpdate:                'voiceStateUpdate',
  voiceServer:                'voiceServerUpdate',
  voiceEffect:                'voiceChannelEffectSend',
  typing:                     'typingStart',
  presence:                   'presenceUpdate',
  userUpdate:                 'userUpdate',
  webhooks:                   'webhooksUpdate',
  inviteCreate:               'inviteCreate',
  inviteDelete:               'inviteDelete',
  threadCreate:               'threadCreate',
  threadDelete:               'threadDelete',
  threadUpdate:               'threadUpdate',
  threadMemberUpdate:         'threadMemberUpdate',
  threadMembersUpdate:        'threadMembersUpdate',
  threadListSync:             'threadListSync',
  stageCreate:                'stageInstanceCreate',
  stageDelete:                'stageInstanceDelete',
  stageUpdate:                'stageInstanceUpdate',
  automodAction:              'autoModerationActionExecution',
  automodCreate:              'autoModerationRuleCreate',
  automodDelete:              'autoModerationRuleDelete',
  automodUpdate:              'autoModerationRuleUpdate',
  emojiCreate:                'emojiCreate',
  emojiDelete:                'emojiDelete',
  emojiUpdate:                'emojiUpdate',
  stickerCreate:              'stickerCreate',
  stickerDelete:              'stickerDelete',
  stickerUpdate:              'stickerUpdate',
  scheduledCreate:            'guildScheduledEventCreate',
  scheduledDelete:            'guildScheduledEventDelete',
  scheduledUpdate:            'guildScheduledEventUpdate',
  scheduledUserAdd:           'guildScheduledEventUserAdd',
  scheduledUserRemove:        'guildScheduledEventUserRemove',
  soundCreate:                'guildSoundboardSoundCreate',
  soundDelete:                'guildSoundboardSoundDelete',
  soundUpdate:                'guildSoundboardSoundUpdate',
  subscriptionCreate:         'subscriptionCreate',
  subscriptionDelete:         'subscriptionDelete',
  subscriptionUpdate:         'subscriptionUpdate',
  ready:                      'ready',
  clientReady:                'clientReady',
  shardReady:                 'shardReady',
  shardDisconnect:            'shardDisconnect',
  shardError:                 'shardError',
  shardReconnect:             'shardReconnecting',
  shardResume:                'shardResume',
  error:                      'error',
  warn:                       'warn',
  debug:                      'debug',
  raw:                        'raw'
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

    // Clone so each bot instance gets its own plugin state
    const plugin = Object.assign(Object.create(null), raw);

    try {
      if (typeof plugin.init === 'function') plugin.init(bot);
    } catch (err) {
      _throwErr(`Plugin[${plugin.name}]#init`, err);
      continue;
    }

    bot.plugin[plugin.name] = plugin;

    if (Array.isArray(plugin.commands)) {
      for (const cmd of plugin.commands) {
        bot._pluginSlashCommands.push({ plugin, cmd });
      }
    }

    if (Array.isArray(plugin.prefixCommands)) {
      for (const cmd of plugin.prefixCommands) {
        bot._pluginPrefixCommands.push({ plugin, cmd });
      }
    }

    if (Array.isArray(plugin.tasks)) {
      for (const task of plugin.tasks) {
        bot._pluginTasks.push({ plugin, task });
      }
    }
  }

  _wirePluginEvents(bot);
}

function _wirePluginEvents(bot) {
  const pluginList = () => Object.values(bot.plugin);

  // ── ready ──────────────────────────────────────────────────────────
  Client.prototype.on.call(bot, 'clientReady', async () => {
    // Register slash commands globally
    if (bot._pluginSlashCommands.length > 0) {
      try {
        const body = bot._pluginSlashCommands.map(({ cmd }) => ({
          name:        cmd.name,
          description: cmd.description,
          options:     cmd.options || []
        }));
        await bot.rest.put(Routes.applicationCommands(bot.user.id), { body });
      } catch (err) {
        _throwErr('Plugin slash command registration', err);
      }
    }

    // Start scheduled tasks
    for (const { plugin, task } of bot._pluginTasks) {
      task._intervalId = setInterval(() => {
        try { task.execute.call(plugin, bot); }
        catch (err) { _throwErr(`Plugin[${plugin.name}] task[${task.name}]`, err); }
      }, task.interval);
    }

    for (const p of pluginList()) _safePluginCall(p, 'onReady');
  });

  // ── messages ───────────────────────────────────────────────────────
  Client.prototype.on.call(bot, 'messageCreate', (msg) => {
    // Message middleware chain — returning false blocks further processing
    for (const p of pluginList()) {
      if (typeof p.messageMiddleware === 'function') {
        try { if (p.messageMiddleware(msg) === false) return; }
        catch (err) { _throwErr(`Plugin[${p.name}]#messageMiddleware`, err); }
      }
    }

    // Prefix command matching
    if (bot._pluginPrefixCommands.length > 0 && msg.content) {
      const prefix = bot.prefix || '!';
      for (const { plugin, cmd } of bot._pluginPrefixCommands) {
        const triggers = [cmd.name, ...(cmd.aliases || [])];
        for (const trigger of triggers) {
          const full = (prefix + trigger).toLowerCase();
          if (msg.content.toLowerCase().startsWith(full)) {
            const args = msg.content.slice(full.length).trim().split(/\s+/).filter(Boolean);
            try { cmd.execute.call(plugin, msg, args); }
            catch (err) { _throwErr(`Plugin[${plugin.name}] prefixCommand[${cmd.name}]`, err); }
            return;
          }
        }
      }
    }

    for (const p of pluginList()) _safePluginCall(p, 'onMessage', msg);
  });

  Client.prototype.on.call(bot, 'messageUpdate', (oldMsg, newMsg) => {
    for (const p of pluginList()) _safePluginCall(p, 'onMessageEdit', oldMsg, newMsg);
  });

  Client.prototype.on.call(bot, 'messageDelete', (msg) => {
    for (const p of pluginList()) _safePluginCall(p, 'onMessageDelete', msg);
  });

  // ── members ────────────────────────────────────────────────────────
  Client.prototype.on.call(bot, 'guildMemberAdd', (member) => {
    for (const p of pluginList()) _safePluginCall(p, 'onMemberJoin', member);
  });

  Client.prototype.on.call(bot, 'guildMemberRemove', (member) => {
    for (const p of pluginList()) _safePluginCall(p, 'onMemberLeave', member);
  });

  Client.prototype.on.call(bot, 'guildMemberUpdate', (oldMember, newMember) => {
    for (const p of pluginList()) _safePluginCall(p, 'onMemberUpdate', oldMember, newMember);
  });

  // ── interactions ───────────────────────────────────────────────────
  Client.prototype.on.call(bot, 'interactionCreate', (interaction) => {
    // Interaction middleware chain
    for (const p of pluginList()) {
      if (typeof p.interactionMiddleware === 'function') {
        try { if (p.interactionMiddleware(interaction) === false) return; }
        catch (err) { _throwErr(`Plugin[${p.name}]#interactionMiddleware`, err); }
      }
    }

    // Route slash commands to the matching plugin command handler
    if (interaction.isChatInputCommand()) {
      for (const { plugin, cmd } of bot._pluginSlashCommands) {
        if (cmd.name === interaction.commandName) {
          try { cmd.execute.call(plugin, interaction); }
          catch (err) { _throwErr(`Plugin[${plugin.name}] command[${cmd.name}]`, err); }
        }
      }
    }

    // Dispatch to plugin hooks
    for (const p of pluginList()) {
      _safePluginCall(p, 'onInteraction', interaction);
      if (interaction.isChatInputCommand()) _safePluginCall(p, 'onSlashCommand', interaction);
      if (interaction.isButton())           _safePluginCall(p, 'onButton', interaction);
      if (interaction.isStringSelectMenu()) _safePluginCall(p, 'onSelectMenu', interaction);
      if (interaction.isModalSubmit())      _safePluginCall(p, 'onModal', interaction);
    }
  });

  // ── guilds ─────────────────────────────────────────────────────────
  Client.prototype.on.call(bot, 'guildCreate', (guild) => {
    for (const p of pluginList()) _safePluginCall(p, 'onGuildJoin', guild);
  });

  Client.prototype.on.call(bot, 'guildDelete', (guild) => {
    for (const p of pluginList()) _safePluginCall(p, 'onGuildLeave', guild);
  });

  // ── voice ──────────────────────────────────────────────────────────
  Client.prototype.on.call(bot, 'voiceStateUpdate', (oldState, newState) => {
    for (const p of pluginList()) _safePluginCall(p, 'onVoiceUpdate', oldState, newState);
  });

  // ── roles & channels ───────────────────────────────────────────────
  Client.prototype.on.call(bot, 'roleCreate',    (role)    => { for (const p of pluginList()) _safePluginCall(p, 'onRoleCreate',    role); });
  Client.prototype.on.call(bot, 'roleDelete',    (role)    => { for (const p of pluginList()) _safePluginCall(p, 'onRoleDelete',    role); });
  Client.prototype.on.call(bot, 'channelCreate', (channel) => { for (const p of pluginList()) _safePluginCall(p, 'onChannelCreate', channel); });
  Client.prototype.on.call(bot, 'channelDelete', (channel) => { for (const p of pluginList()) _safePluginCall(p, 'onChannelDelete', channel); });

  // ── error & destroy ────────────────────────────────────────────────
  Client.prototype.on.call(bot, 'error', (error) => {
    for (const p of pluginList()) _safePluginCall(p, 'onError', error);
  });

  Client.prototype.once.call(bot, 'destroy', () => {
    for (const { task } of bot._pluginTasks) {
      if (task._intervalId) clearInterval(task._intervalId);
    }
    for (const p of pluginList()) _safePluginCall(p, 'onDestroy');
  });
}

// ─────────────────────────────────────────────
//  Bot
// ─────────────────────────────────────────────
class Bot extends Client {
  constructor(options = {}) {
    const intents =
      options.intents === 'all'
        ? Object.values(GatewayIntentBits)
        : options.intents;

    const partials =
      options.partials === 'all'
        ? Object.values(Partials)
        : options.partials;

    const allowedMentions = options.allowedMentions || {
      parse: ['users', 'roles', 'everyone'],
      repliedUser: true
    };

    super({ intents, partials, allowedMentions });
    this.owners = options.owners || [];
    this.prefix = options.prefix || '!';

    // Plugin system
    this.plugin               = {};
    this._pluginTasks         = [];
    this._pluginPrefixCommands = [];
    this._pluginSlashCommands  = [];

    if (Array.isArray(options.plugins) && options.plugins.length > 0) {
      _loadPlugins(this, options.plugins);
    }
  }

  async start(token) {
    try {
      this.rest = new REST({ version: '10' }).setToken(token);
      _client = this;
      await this.login(token);
    } catch (err) {
      _throwErr('Bot#start', err, true);
    }
  }

  isOwner(userId) {
    return this.owners.includes(String(userId));
  }

  async getChannel(id) {
    try {
      return this.channels.cache.get(id) ?? await this.channels.fetch(id);
    } catch (err) {
      _throwErr('Bot#getChannel', err);
      return null;
    }
  }

  on(event, listener) {
    return super.on(EVENT_ALIASES[event] ?? event, listener);
  }

  once(event, listener) {
    return super.once(EVENT_ALIASES[event] ?? event, listener);
  }

  waitFor(event, filter = () => true, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[discord.fixed.js] waitFor timed out on "${event}"`));
      }, timeout);

      const handler = (...args) => {
        if (!filter(...args)) return;
        clearTimeout(timer);
        super.off(EVENT_ALIASES[event] ?? event, handler);
        resolve(args.length === 1 ? args[0] : args);
      };

      super.on(EVENT_ALIASES[event] ?? event, handler);
    });
  }
}

// ─────────────────────────────────────────────
//  Message Patches
// ─────────────────────────────────────────────
(function patchMessage() {
  const proto = Message.prototype;
  const _originalEdit = Message.prototype.edit;

  proto.reply = function (data) {
    if (typeof data === 'string') {
      return this.channel.send({ content: data, flags: MessageFlags.SuppressNotifications });
    }
    const { text, ping = false, ...rest } = data;
    return this.channel.send({
      content: text,
      allowedMentions: ping ? undefined : { users: [] },
      flags: ping ? undefined : MessageFlags.SuppressNotifications,
      ...rest
    });
  };

  proto.edit = function (data) {
    return _originalEdit.call(this, typeof data === 'string' ? { content: data } : data);
  };

  proto.deleteSafe = function () {
    if (this.deletable) return this.delete();
  };

  proto.reactSafe = function (emoji) {
    if (this.reactable) return this.react(emoji);
  };

  proto.ping = function () {
    return this.reply({ text: `<@${this.author.id}>`, ping: true });
  };

  proto.collect = function ({ from, time = 30000, filter, onMessage, onEnd } = {}) {
    const resolvedFilter = filter ?? (from ? (m => m.author.id === from) : () => true);
    const collector = this.channel.createMessageCollector({ filter: resolvedFilter, time });
    if (onMessage) collector.on('collect', onMessage);
    if (onEnd) collector.on('end', onEnd);
    return collector;
  };

  proto.awaitReply = function (filter = () => true, time = 30000) {
    return this.channel.awaitMessages({ filter, max: 1, time, errors: ['time'] })
      .then(collected => collected.first());
  };
})();

// ─────────────────────────────────────────────
//  User Patches
// ─────────────────────────────────────────────
(function patchUser() {
  User.prototype.dm = function (data) {
    const payload = typeof data === 'string' ? { content: data } : data;
    return this.createDM()
      .then(ch => ch.send(payload))
      .catch(err => _throwErr('user.dm', err));
  };
})();

// ─────────────────────────────────────────────
//  GuildMember Patches
// ─────────────────────────────────────────────
(function patchGuildMember() {
  const proto = GuildMember.prototype;

  proto.hasRole = function (roleId) {
    return this.roles.cache.has(roleId);
  };

  proto.can = function (perm) {
    try {
      const bit = typeof perm === 'string'
        ? (PermissionFlagsBits[perm] ?? PermissionFlagsBits[perm.charAt(0).toUpperCase() + perm.slice(1)])
        : perm;
      if (!bit) _throwErr('member.can', new Error(`Unknown permission: "${perm}"`));
      return this.permissions.has(bit);
    } catch (err) {
      _throwErr('member.can', err);
      return false;
    }
  };

  proto.addRole = function (roleId, reason) {
    return this.roles.add(roleId, reason).catch(err => _throwErr('member.addRole', err));
  };

  proto.removeRole = function (roleId, reason) {
    return this.roles.remove(roleId, reason).catch(err => _throwErr('member.removeRole', err));
  };

  proto.timeout = function (minutes, reason) {
    const until = minutes ? Date.now() + minutes * 60_000 : null;
    return this.disableCommunicationUntil(until, reason).catch(err => _throwErr('member.timeout', err));
  };
})();

// ─────────────────────────────────────────────
//  Guild Patches
// ─────────────────────────────────────────────
(function patchGuild() {
  const proto = Guild.prototype;

  proto.findMember = function (query) {
    if (!query) return null;
    const q = String(query).toLowerCase();
    return this.members.cache.get(query)
      ?? this.members.cache.find(m =>
        m.user.username.toLowerCase() === q ||
        m.nickname?.toLowerCase() === q ||
        m.displayName.toLowerCase() === q
      ) ?? null;
  };

  proto.findRole = function (query) {
    if (!query) return null;
    const q = String(query).toLowerCase();
    return this.roles.cache.get(query)
      ?? this.roles.cache.find(r => r.name.toLowerCase() === q)
      ?? null;
  };

  proto.findChannel = function (query) {
    if (!query) return null;
    const q = String(query).toLowerCase();
    return this.channels.cache.get(query)
      ?? this.channels.cache.find(c => c.name?.toLowerCase() === q)
      ?? null;
  };
})();

// ─────────────────────────────────────────────
//  Channel Patches
// ─────────────────────────────────────────────
(function patchChannel() {
  const proto = BaseGuildTextChannel.prototype;

  proto.purge = function (amount = 10) {
    return this.bulkDelete(amount, true).catch(err => _throwErr('channel.purge', err));
  };

  proto.sendEmbed = function (embed) {
    try {
      return this.send({ embeds: Array.isArray(embed) ? embed : [embed] });
    } catch (err) {
      _throwErr('channel.sendEmbed', err);
    }
  };

  proto.sendButtons = function (content, ...rows) {
    try {
      const payload = typeof content === 'string' ? { content } : { ...content };
      payload.components = rows;
      return this.send(payload);
    } catch (err) {
      _throwErr('channel.sendButtons', err);
    }
  };
})();

// ─────────────────────────────────────────────
//  Interaction Patches
// ─────────────────────────────────────────────
(function patchInteraction() {
  const proto = BaseInteraction.prototype;

  proto.ok = function (data, ephemeral = false) {
    try {
      const payload = typeof data === 'string' ? { content: data } : { ...data };
      if (ephemeral) payload.flags = MessageFlags.Ephemeral;
      if (this.replied || this.deferred) return this.editReply(payload);
      return this.reply(payload);
    } catch (err) {
      _throwErr('interaction.ok', err);
    }
  };

  proto.fail = function (data) {
    try {
      const payload = typeof data === 'string' ? { content: data } : { ...data };
      payload.flags = MessageFlags.Ephemeral;
      if (this.replied || this.deferred) return this.editReply(payload);
      return this.reply(payload);
    } catch (err) {
      _throwErr('interaction.fail', err);
    }
  };

  proto.private = function (data) {
    try {
      const payload = typeof data === 'string' ? { content: data } : { ...data };
      payload.flags = MessageFlags.Ephemeral;
      if (this.replied || this.deferred) return this.editReply(payload);
      return this.reply(payload);
    } catch (err) {
      _throwErr('interaction.private', err);
    }
  };

  proto.think = function (ephemeral = false) {
    return this.deferReply({ ephemeral }).catch(err => _throwErr('interaction.think', err));
  };

  proto.refresh = function (data) {
    try {
      const payload = typeof data === 'string' ? { content: data } : { ...data };
      if (this.replied || this.deferred) return this.editReply(payload);
      return this.reply(payload);
    } catch (err) {
      _throwErr('interaction.refresh', err);
    }
  };
})();

// ─────────────────────────────────────────────
//  EmbedBuilder
// ─────────────────────────────────────────────
class EmbedBuilder extends DjsEmbedBuilder {
  constructor(data) { super(data); }

  title(v)          { this.setTitle(String(v));       return this; }
  addTitle(v)       { this.setTitle(String(v));       return this; }
  description(v)    { this.setDescription(String(v)); return this; }
  addDescription(v) { this.setDescription(String(v)); return this; }
  color(v)          { this.setColor(v);               return this; }
  addColor(v)       { this.setColor(v);               return this; }
  thumbnail(url)    { this.setThumbnail(url);         return this; }
  addThumbnail(url) { this.setThumbnail(url);         return this; }
  image(url)        { this.setImage(url);             return this; }
  addImage(url)     { this.setImage(url);             return this; }

  author(name, iconURL, url)    { this.setAuthor({ name, iconURL, url }); return this; }
  addAuthor(name, iconURL, url) { this.setAuthor({ name, iconURL, url }); return this; }
  footer(text, iconURL)         { this.setFooter({ text, iconURL });      return this; }
  addFooter(text, iconURL)      { this.setFooter({ text, iconURL });      return this; }

  field(name, value, inline = false)    { this.addFields({ name: String(name), value: String(value), inline }); return this; }
  addField(name, value, inline = false) { this.addFields({ name: String(name), value: String(value), inline }); return this; }
  fields(arr = []) {
    this.addFields(arr.map(f => ({ name: String(f.name), value: String(f.value), inline: Boolean(f.inline) })));
    return this;
  }

  timestamp(v = Date.now()) { this.setTimestamp(v); return this; }
  addTime(v = Date.now())   { this.setTimestamp(v); return this; }
}

// ─────────────────────────────────────────────
//  Button / Row / Select
// ─────────────────────────────────────────────
const STYLE_MAP = {
  blue: ButtonStyle.Primary,   primary:   ButtonStyle.Primary,
  green: ButtonStyle.Success,  success:   ButtonStyle.Success,
  red: ButtonStyle.Danger,     danger:    ButtonStyle.Danger,
  gray: ButtonStyle.Secondary, grey:      ButtonStyle.Secondary,
  secondary: ButtonStyle.Secondary,       link: ButtonStyle.Link
};

class Button extends DjsButtonBuilder {
  constructor(data) { super(data); }

  label(v)         { this.setLabel(String(v));    return this; }
  id(v)            { this.setCustomId(String(v)); return this; }
  url(v)           { this.setURL(String(v));      return this; }
  emoji(v)         { this.setEmoji(v);            return this; }
  disabled(v=true) { this.setDisabled(v);         return this; }

  style(v) {
    if (typeof v === 'string') this.setStyle(STYLE_MAP[v.toLowerCase()] ?? ButtonStyle[v]);
    else this.setStyle(v);
    return this;
  }
}

class Row extends DjsActionRowBuilder {
  constructor(data) { super(data); }
  add(component)       { this.addComponents(component); return this; }
  components(arr = []) { this.addComponents(arr);        return this; }
}

class Select extends StringSelectMenuBuilder {
  id(i)              { return super.setCustomId(i); }
  placeholder(t)     { return super.setPlaceholder(t); }
  min(v)             { return super.setMinValues(v); }
  max(v)             { return super.setMaxValues(v); }
  option(l, v, d, e) { return super.addOptions({ label: l, value: v, description: d, emoji: e }); }
}

// ─────────────────────────────────────────────
//  Modal Builder
// ─────────────────────────────────────────────
const INPUT_STYLE_MAP = {
  short:     TextInputStyle.Short,
  paragraph: TextInputStyle.Paragraph,
  long:      TextInputStyle.Paragraph
};

class Modal extends DjsModalBuilder {
  constructor() { super(); }

  id(v)    { this.setCustomId(String(v)); return this; }
  title(v) { this.setTitle(String(v));    return this; }

  field(label, id, style = 'short', options = {}) {
    try {
      const input = new TextInputBuilder()
        .setCustomId(String(id))
        .setLabel(String(label))
        .setStyle(INPUT_STYLE_MAP[style.toLowerCase()] ?? TextInputStyle.Short);

      if (options.placeholder) input.setPlaceholder(options.placeholder);
      if (options.required !== undefined) input.setRequired(options.required);
      if (options.min !== undefined) input.setMinLength(options.min);
      if (options.max !== undefined) input.setMaxLength(options.max);
      if (options.value !== undefined) input.setValue(options.value);

      this.addComponents(new DjsActionRowBuilder().addComponents(input));
      return this;
    } catch (err) {
      _throwErr('Modal#field', err);
      return this;
    }
  }
}

// ─────────────────────────────────────────────
//  ComponentBuilder
// ─────────────────────────────────────────────
class ComponentBuilder extends ContainerBuilder {
  constructor() { super(); }

  addText(input) {
    this.addTextDisplayComponents(
      typeof input === 'string' ? new TextDisplayBuilder().setContent(input) : input
    );
    return this;
  }

  addSeparator(spacing = 'Small') {
    const map = { Small: SeparatorSpacingSize.Small, Large: SeparatorSpacingSize.Large };
    this.addSeparatorComponents(new SeparatorBuilder().setSpacing(map[spacing] ?? SeparatorSpacingSize.Small));
    return this;
  }

  addButtons(...buttons) {
    this.addActionRowComponents(new DjsActionRowBuilder().addComponents(buttons));
    return this;
  }

  addSelect(select) {
    this.addActionRowComponents(new DjsActionRowBuilder().addComponents(select));
    return this;
  }

  addMedia(items = []) {
    const gallery = new MediaGalleryBuilder();
    for (const item of items) {
      gallery.addItems(typeof item === 'string' ? new MediaGalleryItemBuilder().setURL(item) : item);
    }
    this.addMediaGalleryComponents(gallery);
    return this;
  }
}

const text = content => new TextDisplayBuilder().setContent(content);

// ─────────────────────────────────────────────
//  VoiceChannelStatus
// ─────────────────────────────────────────────
class VoiceChannelStatus {
  static async set(statusText, id) { await _setStatus(statusText, id); }
  static async remove(id)          { await _setStatus(null, id); }
}

async function _setStatus(statusText, id) {
  if (!_client) return _throwErr('VoiceChannelStatus', new Error('Bot#start() has not been called yet.'));
  try {
    const channel = await _client.channels.fetch(id);
    if (!channel) return _throwErr('VoiceChannelStatus', new Error(`Invalid channel ID: "${id}"`));
    if (channel.type !== ChannelType.GuildVoice) return _throwErr('VoiceChannelStatus', new Error(`Channel "${id}" is not a voice channel.`));
    await _client.rest.put(`/channels/${channel.id}/voice-status`, { body: { text: statusText } });
  } catch (err) {
    _throwErr('VoiceChannelStatus', err);
  }
}

// ─────────────────────────────────────────────
//  sendWebhook
// ─────────────────────────────────────────────
async function sendWebhook(url, data) {
  try {
    const client = new WebhookClient({ url });
    const payload = typeof data === 'string' ? { content: data } : data;
    return await client.send(payload);
  } catch (err) {
    _throwErr('sendWebhook', err);
  }
}

// ─────────────────────────────────────────────
//  Timestamp Helper
// ─────────────────────────────────────────────
const TIME_STYLES = {
  short:    't',  // 9:41 PM
  long:     'T',  // 9:41:30 PM
  date:     'd',  // 01/01/2021
  longdate: 'D',  // January 1, 2021
  full:     'f',  // January 1, 2021 9:41 PM
  longfull: 'F',  // Friday, January 1, 2021 9:41 PM
  relative: 'R'   // 2 years ago
};

function time(date, style = 'relative') {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return _throwErr('time()', new Error(`Invalid date value: "${date}"`)) || '';
    const unix = Math.floor(d.getTime() / 1000);
    const s = TIME_STYLES[style] ?? style;
    return `<t:${unix}:${s}>`;
  } catch (err) {
    _throwErr('time()', err);
    return '';
  }
}

// ─────────────────────────────────────────────
//  Color Constants
// ─────────────────────────────────────────────
const Colors = {
  blurple:     '#5865F2',
  white:       '#FFFFFF',
  black:       '#23272A',
  dark:        '#2B2D31',
  gray:        '#95A5A6',
  grey:        '#95A5A6',
  red:         '#ED4245',
  green:       '#57F287',
  yellow:      '#FEE75C',
  blue:        '#3498DB',
  orange:      '#E67E22',
  purple:      '#9B59B6',
  pink:        '#EB459E',
  gold:        '#F1C40F',
  teal:        '#1ABC9C',
  cyan:        '#1ABCF2',
  navy:        '#34495E',
  transparent: '#2B2D31'
};

// ─────────────────────────────────────────────
//  Cooldown Manager
// ─────────────────────────────────────────────
class Cooldown {
  constructor(ms) {
    if (typeof ms !== 'number' || ms <= 0) {
      _throwErr('Cooldown', new Error(`Invalid cooldown duration: "${ms}". Must be a positive number (ms).`), true);
    }
    this._ms  = ms;
    this._map = new Map();
  }

  check(id) {
    const exp = this._map.get(String(id));
    if (!exp) return false;
    if (Date.now() < exp) return true;
    this._map.delete(String(id));
    return false;
  }

  set(id) {
    this._map.set(String(id), Date.now() + this._ms);
  }

  clear(id) {
    this._map.delete(String(id));
  }

  remaining(id) {
    const exp = this._map.get(String(id));
    if (!exp) return 0;
    const left = exp - Date.now();
    return left > 0 ? left : 0;
  }

  remainingText(id) {
    const ms = this.remaining(id);
    if (!ms) return '0s';
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem ? `${m}m ${rem}s` : `${m}m`;
  }

  reset() {
    this._map.clear();
  }
}

// ─────────────────────────────────────────────
//  Aliases
// ─────────────────────────────────────────────
MessageFlags.V2 = MessageFlags.IsComponentsV2;

const I              = GatewayIntentBits;
const Intents        = GatewayIntentBits;
const IntentBits     = GatewayIntentBits;
const Flags          = MessageFlags;
const MessageFlag    = MessageFlags;
const MsgFlags       = MessageFlags;
const Perms          = PermissionFlagsBits;
const Permissions    = PermissionFlagsBits;
const PermissionBits = PermissionFlagsBits;
const Channels       = ChannelType;
const ChannelTypes   = ChannelType;
const Components     = ComponentType;
const ComponentTypes = ComponentType;
const Buttons        = ButtonStyle;
const ButtonStyles   = ButtonStyle;
const Inputs         = TextInputStyle;
const InputStyles    = TextInputStyle;
const Interactions   = InteractionType;
const InteractionTypes    = InteractionType;
const WebClient           = WebhookClient;
const Web                 = WebhookClient;
const Webhook             = WebhookClient;
const WebhookClientClass  = WebhookClient;

module.exports = {
  // Core
  Bot,
  // Builders
  EmbedBuilder, Embed: EmbedBuilder,
  Button, Row, Select,
  Modal,
  ComponentBuilder, text,
  TextDisplayBuilder, SeparatorBuilder,
  ActionRowBuilder: DjsActionRowBuilder,
  ButtonBuilder: DjsButtonBuilder,
  StringSelectMenuBuilder,
  MediaGalleryBuilder, MediaGalleryItemBuilder,
  // Voice
  VoiceChannelStatus, VCS: VoiceChannelStatus, VCStatus: VoiceChannelStatus,
  // Helpers
  sendWebhook,
  time,
  Colors,
  Cooldown,
  // Aliases
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
