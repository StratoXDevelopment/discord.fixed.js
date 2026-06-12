import {
  Client,
  ClientOptions,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
  ComponentType,
  ButtonStyle,
  TextInputStyle,
  InteractionType,
  WebhookClient,
  EmbedBuilder as DjsEmbedBuilder,
  ButtonBuilder as DjsButtonBuilder,
  ActionRowBuilder as DjsActionRowBuilder,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder as DjsModalBuilder,
  MessageEditOptions,
  TextChannel,
  InteractionReplyOptions,
  BaseChannel,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
  BaseInteraction as DjsBaseInteraction,
  Message,
  GuildMember,
  Guild,
  Role,
  VoiceState,
  GuildChannel
} from 'discord.js';

// ─────────────────────────────────────────────
//  Plugin System
// ─────────────────────────────────────────────
export interface PluginSlashCommand {
  name: string;
  description: string;
  options?: any[];
  execute(interaction: ChatInputCommandInteraction): void | Promise<void>;
}

export interface PluginPrefixCommand {
  name: string;
  aliases?: string[];
  execute(msg: Message, args: string[]): void | Promise<void>;
}

export interface PluginTask {
  name: string;
  /** Interval in milliseconds */
  interval: number;
  execute(bot: Bot): void | Promise<void>;
  /** Internal — set by the library at runtime */
  _intervalId?: ReturnType<typeof setInterval>;
}

export interface Plugin {
  /** Unique name — used as the key on bot.plugin.<name> */
  name: string;

  // ── Lifecycle ──────────────────────────────
  init?(bot: Bot): void;
  onReady?(): void;
  onDestroy?(): void;

  // ── Message hooks ──────────────────────────
  onMessage?(msg: Message): void;
  onMessageEdit?(oldMsg: Message, newMsg: Message): void;
  onMessageDelete?(msg: Message): void;

  // ── Member hooks ───────────────────────────
  onMemberJoin?(member: GuildMember): void;
  onMemberLeave?(member: GuildMember): void;
  onMemberUpdate?(oldMember: GuildMember, newMember: GuildMember): void;

  // ── Interaction hooks ──────────────────────
  onInteraction?(interaction: DjsBaseInteraction): void;
  onSlashCommand?(interaction: ChatInputCommandInteraction): void;
  onButton?(interaction: ButtonInteraction): void;
  onSelectMenu?(interaction: AnySelectMenuInteraction): void;
  onModal?(interaction: ModalSubmitInteraction): void;

  // ── Middleware ─────────────────────────────
  /** Return false to stop the message from reaching other handlers */
  messageMiddleware?(msg: Message): boolean | void;
  /** Return false to stop the interaction from reaching other handlers */
  interactionMiddleware?(interaction: DjsBaseInteraction): boolean | void;

  // ── Commands & tasks ───────────────────────
  commands?: PluginSlashCommand[];
  prefixCommands?: PluginPrefixCommand[];
  tasks?: PluginTask[];

  // ── Guild hooks ────────────────────────────
  onGuildJoin?(guild: Guild): void;
  onGuildLeave?(guild: Guild): void;

  // ── Voice hooks ────────────────────────────
  onVoiceUpdate?(oldState: VoiceState, newState: VoiceState): void;

  // ── Role / channel hooks ───────────────────
  onRoleCreate?(role: Role): void;
  onRoleDelete?(role: Role): void;
  onChannelCreate?(channel: GuildChannel): void;
  onChannelDelete?(channel: GuildChannel): void;

  // ── Error hook ─────────────────────────────
  onError?(error: Error): void;

  // Allow plugins to define their own properties/methods
  [key: string]: any;
}

// ─────────────────────────────────────────────
//  Bot
// ─────────────────────────────────────────────
export interface BotOptions {
  intents?: 'all' | ClientOptions['intents'];
  partials?: 'all' | ClientOptions['partials'];
  owners?: string[];
  prefix?: string;
  plugins?: Plugin[];
  allowedMentions?: ClientOptions['allowedMentions'];
}

export class Bot extends Client {
  owners: string[];
  prefix: string;
  /** Map of loaded plugins keyed by plugin name */
  plugin: Record<string, Plugin>;
  constructor(options?: BotOptions);
  start(token: string): Promise<void>;
  isOwner(userId: string): boolean;
  getChannel(id: string): Promise<BaseChannel | null>;
  waitFor<T = any>(event: string, filter?: (...args: any[]) => boolean, timeout?: number): Promise<T>;
}

// ─────────────────────────────────────────────
//  EmbedBuilder
// ─────────────────────────────────────────────
export class EmbedBuilder extends DjsEmbedBuilder {
  constructor(data?: ConstructorParameters<typeof DjsEmbedBuilder>[0]);
  title(value: string): this;
  addTitle(value: string): this;
  description(value: string): this;
  addDescription(value: string): this;
  color(value: Parameters<DjsEmbedBuilder['setColor']>[0]): this;
  addColor(value: Parameters<DjsEmbedBuilder['setColor']>[0]): this;
  author(name: string, iconURL?: string, url?: string): this;
  addAuthor(name: string, iconURL?: string, url?: string): this;
  footer(text: string, iconURL?: string): this;
  addFooter(text: string, iconURL?: string): this;
  thumbnail(url: string): this;
  addThumbnail(url: string): this;
  image(url: string): this;
  addImage(url: string): this;
  field(name: string, value: string, inline?: boolean): this;
  addField(name: string, value: string, inline?: boolean): this;
  fields(arr: { name: string; value: string; inline?: boolean }[]): this;
  timestamp(value?: number | Date): this;
  addTime(value?: number | Date): this;
}

export const Embed: typeof EmbedBuilder;

// ─────────────────────────────────────────────
//  Button / Row / Select
// ─────────────────────────────────────────────
type ButtonStyleInput =
  | 'blue' | 'primary' | 'green' | 'success'
  | 'red'  | 'danger'  | 'gray'  | 'grey'
  | 'secondary' | 'link'
  | keyof typeof ButtonStyle
  | ButtonStyle;

export class Button extends DjsButtonBuilder {
  constructor(data?: ConstructorParameters<typeof DjsButtonBuilder>[0]);
  label(value: string): this;
  id(value: string): this;
  style(value: ButtonStyleInput): this;
  url(value: string): this;
  emoji(value: Parameters<DjsButtonBuilder['setEmoji']>[0]): this;
  disabled(value?: boolean): this;
}

export class Row extends DjsActionRowBuilder {
  constructor(data?: ConstructorParameters<typeof DjsActionRowBuilder>[0]);
  add(component: Parameters<DjsActionRowBuilder['addComponents']>[0]): this;
  components(arr: Parameters<DjsActionRowBuilder['addComponents']>[0][]): this;
}

export class Select extends StringSelectMenuBuilder {
  id(id: string): this;
  placeholder(text: string): this;
  min(v: number): this;
  max(v: number): this;
  option(label: string, value: string, description?: string, emoji?: string): this;
}

// ─────────────────────────────────────────────
//  Modal Builder
// ─────────────────────────────────────────────
export interface ModalFieldOptions {
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  value?: string;
}

export class Modal extends DjsModalBuilder {
  constructor();
  id(value: string): this;
  title(value: string): this;
  field(label: string, id: string, style?: 'short' | 'paragraph' | 'long', options?: ModalFieldOptions): this;
}

// ─────────────────────────────────────────────
//  ComponentBuilder
// ─────────────────────────────────────────────
export class ComponentBuilder extends ContainerBuilder {
  constructor();
  addText(input: string | TextDisplayBuilder): this;
  addSeparator(spacing?: 'Small' | 'Large'): this;
  addButtons(...buttons: InstanceType<typeof DjsButtonBuilder>[]): this;
  addSelect(select: StringSelectMenuBuilder): this;
  addMedia(items: (string | MediaGalleryItemBuilder)[]): this;
}

export function text(content: string): TextDisplayBuilder;
export { TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder };
export { DjsActionRowBuilder as ActionRowBuilder, DjsButtonBuilder as ButtonBuilder, StringSelectMenuBuilder };

// ─────────────────────────────────────────────
//  VoiceChannelStatus
// ─────────────────────────────────────────────
export class VoiceChannelStatus {
  static set(text: string, channelId: string): Promise<void>;
  static remove(channelId: string): Promise<void>;
}

export const VCS: typeof VoiceChannelStatus;
export const VCStatus: typeof VoiceChannelStatus;

// ─────────────────────────────────────────────
//  Timestamp Helper
// ─────────────────────────────────────────────
export type TimeStyle = 'short' | 'long' | 'date' | 'longdate' | 'full' | 'longfull' | 'relative';
export function time(date: Date | number | string, style?: TimeStyle | string): string;

// ─────────────────────────────────────────────
//  Color Constants
// ─────────────────────────────────────────────
export const Colors: {
  blurple:     string;
  white:       string;
  black:       string;
  dark:        string;
  gray:        string;
  grey:        string;
  red:         string;
  green:       string;
  yellow:      string;
  blue:        string;
  orange:      string;
  purple:      string;
  pink:        string;
  gold:        string;
  teal:        string;
  cyan:        string;
  navy:        string;
  transparent: string;
};

// ─────────────────────────────────────────────
//  Cooldown Manager
// ─────────────────────────────────────────────
export class Cooldown {
  constructor(ms: number);
  /** Returns true if user is on cooldown */
  check(id: string): boolean;
  /** Starts cooldown for a user */
  set(id: string): void;
  /** Removes cooldown for a user */
  clear(id: string): void;
  /** Returns remaining ms */
  remaining(id: string): number;
  /** Returns remaining time as human-readable string e.g. "5s", "2m 30s" */
  remainingText(id: string): string;
  /** Clears all active cooldowns */
  reset(): void;
}

// ─────────────────────────────────────────────
//  Prototype Extensions
// ─────────────────────────────────────────────
declare module 'discord.js' {
  interface Message {
    reply(data: string | ({ text: string; ping?: boolean } & Partial<MessageEditOptions>)): Promise<Message>;
    edit(data: string | MessageEditOptions): Promise<Message>;
    deleteSafe(): Promise<Message> | undefined;
    reactSafe(emoji: string): Promise<any> | undefined;
    ping(): Promise<Message>;
    collect(options?: {
      from?: string;
      time?: number;
      filter?: (m: Message) => boolean;
      onMessage?: (m: Message) => void;
      onEnd?: (collected: any) => void;
    }): any;
    awaitReply(filter?: (m: Message) => boolean, time?: number): Promise<Message>;
  }

  interface User {
    dm(data: string | Record<string, any>): Promise<any>;
  }

  interface GuildMember {
    hasRole(roleId: string): boolean;
    can(perm: string | bigint): boolean;
    addRole(roleId: string, reason?: string): Promise<GuildMember>;
    removeRole(roleId: string, reason?: string): Promise<GuildMember>;
    timeout(minutes: number | null, reason?: string): Promise<GuildMember>;
  }

  interface Guild {
    findMember(query: string): GuildMember | null;
    findRole(query: string): Role | null;
    findChannel(query: string): BaseChannel | null;
  }

  interface BaseGuildTextChannel {
    purge(amount?: number): Promise<any>;
    sendEmbed(embed: any | any[]): Promise<Message>;
    sendButtons(content: string | Record<string, any>, ...rows: any[]): Promise<Message>;
  }

  interface BaseInteraction {
    ok(data: string | InteractionReplyOptions, ephemeral?: boolean): Promise<any>;
    fail(data: string | InteractionReplyOptions): Promise<any>;
    private(data: string | InteractionReplyOptions): Promise<any>;
    think(ephemeral?: boolean): Promise<any>;
    refresh(data: string | InteractionReplyOptions): Promise<any>;
  }
}

// ─────────────────────────────────────────────
//  sendWebhook
// ─────────────────────────────────────────────
export function sendWebhook(url: string, data: string | Record<string, any>): Promise<any>;

// ─────────────────────────────────────────────
//  Aliases
// ─────────────────────────────────────────────
export const I: typeof GatewayIntentBits;
export const Intents: typeof GatewayIntentBits;
export const IntentBits: typeof GatewayIntentBits;

export const Flags: typeof MessageFlags & { V2: number };
export const MessageFlag: typeof Flags;
export const MsgFlags: typeof Flags;

export const Perms: typeof PermissionFlagsBits;
export const Permissions: typeof PermissionFlagsBits;
export const PermissionBits: typeof PermissionFlagsBits;

export const Channels: typeof ChannelType;
export const ChannelTypes: typeof ChannelType;

export const Components: typeof ComponentType;
export const ComponentTypes: typeof ComponentType;

export const Buttons: typeof ButtonStyle;
export const ButtonStyles: typeof ButtonStyle;

export const Inputs: typeof TextInputStyle;
export const InputStyles: typeof TextInputStyle;

export const Interactions: typeof InteractionType;
export const InteractionTypes: typeof InteractionType;

export const WebClient: typeof WebhookClient;
export const Web: typeof WebhookClient;
export const Webhook: typeof WebhookClient;
export const WebhookClientClass: typeof WebhookClient;
export { WebhookClient };
