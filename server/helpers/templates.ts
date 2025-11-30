import Handlebars from 'handlebars';
import { readFile, access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { H3Event } from 'h3';
import { requestContext } from '../utils/request-context';
import { env } from './env';
import { getAllFlags, getSlotKeysInOrder } from '../models/inventoryFlags';

export interface NormalizedKillmailEntity {
  id: number | null;
  name: string;
  ticker?: string;
}

export interface NormalizedKillmailAttacker {
  character: NormalizedKillmailEntity;
  corporation: NormalizedKillmailEntity;
  alliance?: NormalizedKillmailEntity;
}

export interface NormalizedKillmail {
  killmailId: number;
  killmailTime: string;
  victim: {
    ship: {
      typeId: number;
      name: string;
      group: string;
    };
    character: NormalizedKillmailEntity;
    corporation: NormalizedKillmailEntity;
    alliance?: NormalizedKillmailEntity;
  };
  attackers: NormalizedKillmailAttacker[];
  solarSystem: {
    id: number;
    name: string;
    region: string;
  };
  shipValue: number;
  totalValue: number;
  attackerCount: number;
  isLoss: boolean;
  isSolo: boolean;
  isNpc: boolean;
}

export function normalizeKillRow(km: any): NormalizedKillmail {
  const killmailId = Number(km.killmailId ?? km.killmail_id ?? 0);
  const killmailRawTime = km.killmailTime ?? km.killmail_time ?? '';
  const killmailTime =
    killmailRawTime instanceof Date
      ? formatNaiveDateAsUtcString(killmailRawTime)
      : normalizeTimeString(String(killmailRawTime));

  const victimShipTypeId = Number(
    km.victimShipTypeId ?? km.victim_ship_type_id ?? 0
  );
  const victimShipName =
    km.victimShipName ?? km.victim_ship_name ?? 'Unknown Ship';
  const victimShipGroup =
    km.victimShipGroup ?? km.victim_ship_group ?? 'Unknown';

  const victimCharacterId =
    km.victimCharacterId ?? km.victim_character_id ?? null;
  const victimCharacterName =
    km.victimCharacterName ?? km.victim_character_name ?? 'Unknown';
  const victimCorporationId =
    km.victimCorporationId ?? km.victim_corporation_id ?? null;
  const victimCorporationName =
    km.victimCorporationName ?? km.victim_corporation_name ?? 'Unknown Corp';
  const victimCorporationTicker =
    km.victimCorporationTicker ?? km.victim_corporation_ticker ?? '???';
  const victimAllianceId = km.victimAllianceId ?? km.victim_alliance_id ?? null;
  const victimAllianceName =
    km.victimAllianceName ?? km.victim_alliance_name ?? 'Unknown Alliance';
  const victimAllianceTicker =
    km.victimAllianceTicker ?? km.victim_alliance_ticker ?? '???';

  const attackerCharacterId =
    km.attackerCharacterId ??
    km.topAttackerCharacterId ??
    km.attacker_character_id ??
    null;
  const attackerCharacterName =
    km.attackerCharacterName ??
    km.topAttackerCharacterName ??
    km.attacker_character_name ??
    (attackerCharacterId ? 'Unknown' : 'Unknown');
  const attackerCorporationId =
    km.attackerCorporationId ??
    km.topAttackerCorporationId ??
    km.attacker_corporation_id ??
    null;
  const attackerCorporationName =
    km.attackerCorporationName ??
    km.topAttackerCorporationName ??
    km.attacker_corporation_name ??
    (attackerCorporationId ? 'Unknown Corp' : 'Unknown Corp');
  const attackerCorporationTicker =
    km.attackerCorporationTicker ??
    km.topAttackerCorporationTicker ??
    km.attacker_corporation_ticker ??
    '???';
  const attackerAllianceId =
    km.attackerAllianceId ??
    km.topAttackerAllianceId ??
    km.attacker_alliance_id ??
    null;
  const attackerAllianceName =
    km.attackerAllianceName ??
    km.topAttackerAllianceName ??
    km.attacker_alliance_name ??
    (attackerAllianceId ? 'Unknown Alliance' : 'Unknown Alliance');
  const attackerAllianceTicker =
    km.attackerAllianceTicker ??
    km.topAttackerAllianceTicker ??
    km.attacker_alliance_ticker ??
    '???';

  const attackers: NormalizedKillmailAttacker[] =
    Array.isArray(km.attackers) && km.attackers.length > 0
      ? km.attackers.map((a: any) => {
          const characterId =
            a.character?.id ?? a.characterId ?? a.character_id ?? null;
          const corporationId =
            a.corporation?.id ?? a.corporationId ?? a.corporation_id ?? null;
          const allianceId =
            a.alliance?.id ?? a.allianceId ?? a.alliance_id ?? null;

          return {
            character: {
              id: characterId,
              name:
                a.character?.name ??
                a.characterName ??
                a.character_name ??
                'Unknown',
            },
            corporation: {
              id: corporationId,
              name:
                a.corporation?.name ??
                a.corporationName ??
                a.corporation_name ??
                'Unknown Corp',
              ticker:
                a.corporation?.ticker ??
                a.corporationTicker ??
                a.corporation_ticker ??
                '???',
            },
            alliance:
              allianceId != null
                ? {
                    id: allianceId,
                    name:
                      a.alliance?.name ??
                      a.allianceName ??
                      a.alliance_name ??
                      'Unknown Alliance',
                    ticker:
                      a.alliance?.ticker ??
                      a.allianceTicker ??
                      a.alliance_ticker ??
                      '???',
                  }
                : undefined,
          };
        })
      : [];

  if (
    attackers.length === 0 &&
    (attackerCharacterId ||
      attackerCharacterName ||
      attackerCorporationId ||
      attackerCorporationName)
  ) {
    attackers.push({
      character: {
        id: attackerCharacterId,
        name: attackerCharacterName || 'Unknown',
      },
      corporation: {
        id: attackerCorporationId,
        name: attackerCorporationName || 'Unknown Corp',
        ticker: attackerCorporationTicker || '???',
      },
      alliance:
        attackerAllianceId != null
          ? {
              id: attackerAllianceId,
              name: attackerAllianceName || 'Unknown Alliance',
              ticker: attackerAllianceTicker || '???',
            }
          : undefined,
    });
  }

  const attackerCount =
    km.attackerCount ?? km.attacker_count ?? attackers.length;

  // Calculate relative time
  const now = new Date();
  const past = new Date(killmailTime);
  const diffMs = now.getTime() - past.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let killmailTimeRelative = 'Just now';
  if (days > 0) killmailTimeRelative = `${days} day${days > 1 ? 's' : ''} ago`;
  else if (hours > 0)
    killmailTimeRelative = `${hours} hour${hours > 1 ? 's' : ''} ago`;
  else if (minutes > 0)
    killmailTimeRelative = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

  return {
    killmailId,
    killmailTime,
    killmailTimeRelative,
    victim: {
      ship: {
        typeId: victimShipTypeId,
        name: victimShipName,
        group: victimShipGroup,
      },
      character: {
        id: victimCharacterId,
        name: victimCharacterName,
      },
      corporation: {
        id: victimCorporationId,
        name: victimCorporationName,
        ticker: victimCorporationTicker,
      },
      alliance:
        victimAllianceId != null
          ? {
              id: victimAllianceId,
              name: victimAllianceName,
              ticker: victimAllianceTicker,
            }
          : undefined,
    },
    attackers,
    solarSystem: {
      id: km.solarSystemId ?? km.solar_system_id ?? 0,
      name: km.solarSystemName ?? km.solar_system_name ?? 'Unknown System',
      region: km.regionName ?? km.region_name ?? 'Unknown Region',
    },
    shipValue: km.shipValue ?? km.ship_value ?? 0,
    totalValue: km.totalValue ?? km.total_value ?? 0,
    attackerCount,
    isLoss: Boolean(km.isLoss ?? km.is_loss ?? false),
    isSolo: Boolean(km.isSolo ?? km.is_solo ?? attackerCount === 1),
    isNpc: Boolean(km.isNpc ?? km.is_npc ?? false),
  };
}

function formatNaiveDateAsUtcString(date: Date): string {
  // Treat the wall-clock value as UTC (timestamp without tz from DB) using UTC getters
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const millis = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}Z`;
}

function normalizeTimeString(value: string): string {
  if (!value) return value;
  // If the string already has timezone info, keep it. Otherwise append Z so it is treated as UTC.
  if (/[+-]\d{2}:?\d{2}$/.test(value) || value.endsWith('Z')) {
    return value;
  }
  // Handle cases where value may already have a space separator from DB
  return value.includes('T') ? `${value}Z` : `${value.replace(' ', 'T')}Z`;
}

// Template cache for compiled templates
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

// Track if partials have been registered
let partialsRegistered = false;

// Get the current theme from environment
function getTheme(): string {
  return env.THEME;
}

// Default page context that's always available
interface DefaultPageContext {
  title: string;
  description: string;
  keywords?: string;
  url?: string;
  image?: string;
  type?: string;
  structuredData?: string;
  skipSiteName?: boolean;
}

// Default data that's always passed to templates
interface DefaultData {
  siteName: string;
  year: number;
  env: string;
}

/**
 * Register custom Handlebars helpers
 */
function registerHelpers() {
  // JSON helper
  Handlebars.registerHelper('json', function (value: any) {
    return JSON.stringify(value);
  });

  // Format number with commas (handles decimals correctly)
  // Format ISK values with appropriate suffix
  Handlebars.registerHelper('formatISK', function (value: number) {
    if (!value || value === 0) return '0 ISK';
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B ISK`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M ISK`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K ISK`;
    return `${value.toLocaleString()} ISK`;
  });

  // Abbreviate ISK for compact display (no ISK suffix)
  Handlebars.registerHelper('abbreviateISK', function (value: number) {
    if (!value || value === 0) return '0';
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  });

  // Format number with comma separators
  Handlebars.registerHelper('formatNumber', function (value: number) {
    if (!value && value !== 0) return '0';
    return value.toLocaleString();
  });

  // URL encode helper for Handlebars block content
  Handlebars.registerHelper('urlencode', function (this: any, options: any) {
    const content = options.fn(this);
    return encodeURIComponent(content.trim());
  });

  // Date formatting
  Handlebars.registerHelper('formatDate', function (date: string | Date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  });

  // EDK-style date formatting (YYYY-MM-DD HH:MM)
  Handlebars.registerHelper('formatDateEDK', function (date: string | Date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  });

  // EDK-style short date for tables
  Handlebars.registerHelper('formatDateShort', function (date: string | Date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  });

  // Time ago helper
  Handlebars.registerHelper('timeAgo', function (date: string | Date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  });

  // Format time ago (more detailed)
  Handlebars.registerHelper('formatTimeAgo', function (date: string | Date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  });

  // Conditional helpers
  Handlebars.registerHelper(
    'ifEquals',
    function (this: any, arg1: any, arg2: any, options: any) {
      return arg1 == arg2 ? options.fn(this) : options.inverse(this);
    }
  );

  Handlebars.registerHelper('eq', function (a: any, b: any) {
    return a === b;
  });

  Handlebars.registerHelper('gt', function (a: number, b: number) {
    return a > b;
  });

  Handlebars.registerHelper('gte', function (a: number, b: number) {
    return a >= b;
  });

  Handlebars.registerHelper('lt', function (a: number, b: number) {
    return a < b;
  });

  Handlebars.registerHelper('lte', function (a: number, b: number) {
    return a <= b;
  });

  // Logical helpers
  Handlebars.registerHelper('and', function (...args: any[]) {
    const values = args.slice(0, -1);
    return values.every((v) => v);
  });

  Handlebars.registerHelper('or', function (...args: any[]) {
    const values = args.slice(0, -1);
    return values.some((v) => !!v);
  });

  // Math helpers
  Handlebars.registerHelper('add', function (a: number, b: number) {
    return a + b;
  });

  Handlebars.registerHelper('subtract', function (a: number, b: number) {
    return a - b;
  });

  Handlebars.registerHelper('multiply', function (a: number, b: number) {
    return a * b;
  });

  Handlebars.registerHelper('mult', function (a: number, b: number) {
    return a * b;
  });

  Handlebars.registerHelper('div', function (a: number, b: number) {
    return b !== 0 ? a / b : 0;
  });

  Handlebars.registerHelper('mod', function (a: number, b: number) {
    return a % b;
  });

  Handlebars.registerHelper('ceil', function (a: number) {
    return Math.ceil(a);
  });

  // Utility helpers
  Handlebars.registerHelper(
    'fallback',
    function (value: any, defaultValue: any) {
      return value !== undefined && value !== null ? value : defaultValue;
    }
  );

  Handlebars.registerHelper('isEven', function (num: number) {
    return num % 2 === 0;
  });

  Handlebars.registerHelper('length', function (array: any[]) {
    return Array.isArray(array) ? array.length : 0;
  });

  Handlebars.registerHelper('concat', function (...args: any[]) {
    return args.slice(0, -1).join('');
  });

  // Array and object creation helpers
  Handlebars.registerHelper('array', function (...args: any[]) {
    return args.slice(0, -1); // Remove Handlebars options object
  });

  Handlebars.registerHelper('obj', function (this: any, options: any) {
    return options.hash; // Returns the hash object from Handlebars
  });

  // Prepare item sections - organizes items by slot type with titles
  Handlebars.registerHelper('prepareItemSections', function (items: any) {
    if (!items || typeof items !== 'object') return [];

    const sections: Array<{ title: string; items: any[] }> = [];

    // Get all inventory flags and build a mapping of slotKey to display title
    const allFlags = getAllFlags();
    const slotKeyToTitle = new Map<string, string>();

    for (const flag of allFlags) {
      if (!slotKeyToTitle.has(flag.slotKey)) {
        // Convert slotKey to display title (e.g., 'droneBay' -> 'Drone Bay')
        const title = flag.slotKey
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
        slotKeyToTitle.set(flag.slotKey, title);
      }
    }

    // Get display order from inventory flags (sorted by displayOrder property)
    const displayOrder = getSlotKeysInOrder();

    // Process sections in display order
    const processedKeys = new Set<string>();

    for (const slotKey of displayOrder) {
      const itemsInSection = items[slotKey];

      // Skip if no items in this section
      if (!Array.isArray(itemsInSection) || itemsInSection.length === 0) {
        continue;
      }

      // Handle combined sections (fighter tubes, structure services)
      if (slotKey === 'fighterTube') {
        // Collect all fighter tube items
        const fighterTubeItems: any[] = [];
        for (let i = 0; i <= 5; i++) {
          const tubeKey = i === 0 ? 'fighterTube' : `fighterTube${i}`;
          if (items[tubeKey]?.length > 0) {
            fighterTubeItems.push(...items[tubeKey]);
            processedKeys.add(tubeKey);
          }
        }
        if (fighterTubeItems.length > 0) {
          sections.push({
            title: 'Fighter Launch Tubes',
            items: fighterTubeItems,
          });
        }
        continue;
      }

      // Get title from mapping, fallback to formatted slotKey
      const title =
        slotKeyToTitle.get(slotKey) ||
        slotKey
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase())
          .trim();

      sections.push({ title, items: itemsInSection });
      processedKeys.add(slotKey);
    }

    // Handle any remaining sections not in display order (future-proofing)
    for (const slotKey of Object.keys(items)) {
      if (!processedKeys.has(slotKey) && items[slotKey]?.length > 0) {
        const title =
          slotKeyToTitle.get(slotKey) ||
          slotKey
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str: string) => str.toUpperCase())
            .trim();
        sections.push({ title, items: items[slotKey] });
      }
    }

    return sections;
  });

  // Calculate damage percentage
  Handlebars.registerHelper(
    'damagePercent',
    function (damage: number, totalDamage: number) {
      if (!damage || !totalDamage || totalDamage === 0) return '0.0';
      return ((damage / totalDamage) * 100).toFixed(1);
    }
  );

  // Security status formatting
  Handlebars.registerHelper('formatSecStatus', function (sec: number) {
    if (sec >= 0.5)
      return `<span style="color: #2fef2f;">${sec.toFixed(1)}</span>`;
    if (sec >= 0.1)
      return `<span style="color: #efef2f;">${sec.toFixed(1)}</span>`;
    return `<span style="color: #ef2f2f;">${sec.toFixed(1)}</span>`;
  });

  Handlebars.registerHelper(
    'formatSecurity',
    function (sec: number | string | undefined) {
      if (sec === undefined || sec === null) return '?';
      const numSec = typeof sec === 'string' ? parseFloat(sec) : sec;
      if (isNaN(numSec)) return '?';
      return numSec.toFixed(1);
    }
  );

  // Lookup type name by typeId
  Handlebars.registerHelper('lookupTypeName', function (typeId: number) {
    // This is a synchronous helper, so we'll need to handle async lookups differently
    // For now, return the typeId as a fallback
    return `Type ${typeId}`;
  });

  // Round up to nearest valid EVE image size
  Handlebars.registerHelper(
    'roundImageSize',
    function (requestedSize: number, type: string) {
      const validSizes =
        type === 'type' || type === 'item' || type === 'ship'
          ? [32, 64, 128, 256, 512]
          : [64, 128, 256, 512];
      for (const size of validSizes) {
        if (size >= requestedSize) return size;
      }
      return validSizes[validSizes.length - 1];
    }
  );

  // Check if killmail is a loss for followed entities
  Handlebars.registerHelper(
    'isFollowedLoss',
    function (victim: any, followedEntities: any) {
      if (!followedEntities || !victim) return false;
      const {
        characterIds = [],
        corporationIds = [],
        allianceIds = [],
      } = followedEntities;
      if (
        characterIds.length > 0 &&
        victim.character?.id &&
        characterIds.includes(victim.character.id)
      )
        return true;
      if (
        corporationIds.length > 0 &&
        victim.corporation?.id &&
        corporationIds.includes(victim.corporation.id)
      )
        return true;
      if (
        allianceIds.length > 0 &&
        victim.alliance?.id &&
        allianceIds.includes(victim.alliance.id)
      )
        return true;
      return false;
    }
  );

  // Check if killmail is a loss for a specific entity
  Handlebars.registerHelper(
    'isEntityLoss',
    function (victim: any, entityType: string, entityId: number) {
      if (!victim || !entityType || !entityId) return false;
      if (entityType === 'character' && victim.character?.id === entityId)
        return true;
      if (entityType === 'corporation' && victim.corporation?.id === entityId)
        return true;
      if (entityType === 'alliance' && victim.alliance?.id === entityId)
        return true;
      return false;
    }
  );

  // Switch/case helper for template control flow
  Handlebars.registerHelper(
    'switch',
    function (this: any, value: any, options: any) {
      this._switch_value_ = value;
      const html = options.fn(this);
      delete this._switch_value_;
      return html;
    }
  );

  Handlebars.registerHelper(
    'case',
    function (this: any, value: any, options: any) {
      if (value == this._switch_value_) {
        return options.fn(this);
      }
    }
  );

  Handlebars.registerHelper('defaultCase', function (this: any, options: any) {
    if (this._switch_value_ === undefined) {
      return options.fn(this);
    }
  });
}

// Register helpers on module load
registerHelpers();

/**
 * Get default data that's always available in templates
 */
function getDefaultData(): DefaultData {
  return {
    siteName: 'EVE-KILL',
    year: new Date().getFullYear(),
    env: env.NODE_ENV,
  };
}

/**
 * Get default page context with sensible defaults
 */
function getDefaultPageContext(): DefaultPageContext {
  return {
    title: 'Home',
    description: 'Real-time killmail tracking and analytics for EVE Online',
    keywords: 'eve online, killmail, pvp, tracking, analytics',
    type: 'website',
  };
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve template path with theme fallback
 *
 * 1. Try: templates/<theme>/<templatePath>
 * 2. Fallback: templates/default/<templatePath>
 * 3. Error if neither exists
 */
async function resolveTemplatePath(templatePath: string): Promise<string> {
  const theme = getTheme();
  const templatesDir = join(process.cwd(), 'templates');

  // Auto-append .hbs extension if not present
  const fullTemplatePath = templatePath.endsWith('.hbs')
    ? templatePath
    : `${templatePath}.hbs`;

  // Try theme-specific template first
  if (theme !== 'default') {
    const themePath = join(templatesDir, theme, fullTemplatePath);
    if (await fileExists(themePath)) {
      logger.debug(`Using theme template: ${theme}/${fullTemplatePath}`);
      return themePath;
    }
    logger.debug(
      `Theme template not found, falling back to default: ${fullTemplatePath}`
    );
  }

  // Fallback to default theme
  const defaultPath = join(templatesDir, 'default', fullTemplatePath);
  if (await fileExists(defaultPath)) {
    return defaultPath;
  }

  // Neither exists - error
  throw new Error(
    `Template not found in theme '${theme}' or 'default': ${fullTemplatePath}`
  );
}

/**
 * Register all partials and components from the templates directory
 */
async function registerPartials() {
  // In dev mode, always re-scan to pick up new files
  const isDev = env.NODE_ENV !== 'production';
  if (partialsRegistered && !isDev) return;

  const theme = getTheme();
  const templatesDir = join(process.cwd(), 'templates', theme);

  // Register partials from partials/ directory
  const partialsDir = join(templatesDir, 'partials');
  if (await fileExists(partialsDir)) {
    try {
      const files = await readdir(partialsDir);
      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const partialName = 'partials/' + file.replace('.hbs', '');
          const partialPath = join(partialsDir, file);
          const partialContent = await readFile(partialPath, 'utf-8');
          Handlebars.registerPartial(partialName, partialContent);
          if (isDev) {
            // logger.debug(`Registered partial: ${partialName}`);
          }
        }
      }
    } catch (error) {
      logger.warn('Could not load partials', { error });
    }
  }

  // Register components from components/ directory
  const componentsDir = join(templatesDir, 'components');
  if (await fileExists(componentsDir)) {
    try {
      const files = await readdir(componentsDir);
      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const componentName = 'components/' + file.replace('.hbs', '');
          const componentPath = join(componentsDir, file);
          const componentContent = await readFile(componentPath, 'utf-8');
          Handlebars.registerPartial(componentName, componentContent);
          if (isDev) {
            // logger.debug(`Registered component: ${componentName}`);
          }
        }
      }
    } catch (error) {
      logger.warn('Could not load components', { error });
    }
  }

  if (!isDev) {
    partialsRegistered = true;
  }
}

/**
 * Load and compile a Handlebars template with theme support
 */
async function loadTemplate(
  templatePath: string
): Promise<HandlebarsTemplateDelegate> {
  // Register partials if not already done
  await registerPartials();

  // Create cache key that includes theme
  const theme = getTheme();
  const cacheKey = `${theme}:${templatePath}`;
  const isDev = env.NODE_ENV !== 'production';

  // Check cache first (skip in dev mode to allow hot reload)
  if (!isDev && templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey)!;
  }

  if (isDev) {
    logger.debug(`[DEV] Loading template: ${templatePath} (cache disabled)`);
  }

  // Resolve template path with fallback
  const fullPath = await resolveTemplatePath(templatePath);

  // Read template file
  const templateSource = await readFile(fullPath, 'utf-8');

  // Compile template
  const template = Handlebars.compile(templateSource);

  // Cache compiled template (only in production)
  if (!isDev) {
    templateCache.set(cacheKey, template);
  }

  return template;
}

/**
 * Render a Handlebars template with the given context and data
 *
 * Template resolution order:
 * 1. If templatePath contains '/', use it as-is (e.g., 'default/index.hbs')
 * 2. Otherwise, try templates/<THEME>/<templatePath>
 * 3. Fallback to templates/default/<templatePath>
 * 4. Error if not found
 *
 * @param templatePath - Template filename (e.g., 'index.hbs') or path (e.g., 'pages/home.hbs')
 * @param pageContext - Page-specific context (title, description, etc.)
 * @param data - Data to pass to the template
 * @param event - H3 event (optional, for setting response headers)
 * @param useLayout - Whether to wrap content in layout (default: true)
 * @param layoutPath - Custom layout path (default: 'layouts/main.hbs')
 * @returns Rendered HTML string
 */
export async function render(
  templatePath: string,
  pageContext: Partial<DefaultPageContext> = {},
  data: any = null,
  event?: H3Event,
  useLayout: boolean = true,
  layoutPath: string = 'layouts/main.hbs'
): Promise<string> {
  // Track template rendering
  const performance =
    event?.context?.performance || requestContext.getStore()?.performance;
  const renderSpanId = performance?.startSpan(`template:render`, 'template', {
    templatePath,
  });

  try {
    // Load main content template
    const loadSpanId = performance?.startSpan(
      `template:load:${templatePath}`,
      'template'
    );
    const contentTemplate = await loadTemplate(templatePath);
    if (loadSpanId) performance?.endSpan(loadSpanId);

    // Merge page context with defaults
    const requestUrl =
      event?.node?.req?.url || (event ? event.path : undefined) || '/';
    const page: DefaultPageContext = {
      ...getDefaultPageContext(),
      ...(requestUrl ? { url: requestUrl } : {}),
      ...pageContext,
    };

    // Build full context
    const context: any = {
      page,
      data,
      ...data,
      default: getDefaultData(),
      config: {
        title: env.SITE_TITLE,
        subtitle: env.SITE_SUBTITLE,
        siteUrl: env.SITE_URL,
        copyright: `© ${new Date().getFullYear()}`,
        showVersion: env.NODE_ENV === 'development',
        imageServerUrl: env.IMAGE_SERVER_URL,
        twitterHandle: env.TWITTER_HANDLE,
      },
      env: {
        WS_URL: env.WS_URL,
        NODE_ENV: env.NODE_ENV,
      },
      version: env.npm_package_version || '0.1.0',
      buildDate: env.BUILD_DATE || new Date().toISOString().split('T')[0],
    };

    // Add performance data if available
    if (performance) {
      const summary = performance.getSummary();
      context.performance = summary;
      // Always show debug bar, but collapsed by default in production
      context.showDebugBar = true;
      context.debug = env.NODE_ENV !== 'production'; // Only true in development
      context.isProd = env.NODE_ENV === 'production';
    }

    // Render content
    const execSpanId = performance?.startSpan(
      `template:execute:${templatePath}`,
      'template'
    );
    const bodyHtml = contentTemplate(context);
    if (execSpanId) performance?.endSpan(execSpanId);

    // If layout is disabled, return just the content
    if (!useLayout) {
      if (event) {
        setResponseHeaders(event, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
        });
      }
      if (renderSpanId) performance?.endSpan(renderSpanId);
      return bodyHtml;
    }

    // Load layout template
    const layoutLoadSpanId = performance?.startSpan(
      `template:load:${layoutPath}`,
      'template'
    );
    const layoutTemplate = await loadTemplate(layoutPath);
    if (layoutLoadSpanId) performance?.endSpan(layoutLoadSpanId);

    // Render layout with body content
    const layoutExecSpanId = performance?.startSpan(
      `template:execute:${layoutPath}`,
      'template'
    );
    const html = layoutTemplate({
      ...context,
      body: bodyHtml,
    });
    if (layoutExecSpanId) performance?.endSpan(layoutExecSpanId);

    // Set response headers if event provided
    if (event) {
      const isAuthenticated = Boolean(event.context?.authUser);
      setResponseHeaders(event, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': isAuthenticated
          ? 'private, no-store, max-age=0'
          : 'public, max-age=60',
      });
    }

    if (renderSpanId) performance?.endSpan(renderSpanId);
    return html;
  } catch (error) {
    if (renderSpanId) performance?.endSpan(renderSpanId);
    const theme = getTheme();
    logger.error('Template rendering error', {
      templatePath,
      theme,
      error: error instanceof Error ? error.message : String(error),
    });

    // Return error page in development
    if (env.NODE_ENV !== 'production') {
      return `
        <!DOCTYPE html>
        <html>
        <head><title>Template Error</title></head>
        <body>
          <h1>Template Rendering Error</h1>
          <p><strong>Template:</strong> ${templatePath}</p>
          <p><strong>Theme:</strong> ${theme}</p>
          <p><strong>Error:</strong> ${
            error instanceof Error ? error.message : String(error)
          }</p>
          <pre>${error instanceof Error ? error.stack : ''}</pre>
        </body>
        </html>
      `;
    }

    throw error;
  }
}

/**
 * Clear template cache (useful for development)
 */
export function clearTemplateCache() {
  templateCache.clear();
  logger.info('Template cache cleared');
}

/**
 * Get template cache stats
 */
export function getTemplateCacheStats() {
  return {
    size: templateCache.size,
    templates: Array.from(templateCache.keys()),
  };
}
