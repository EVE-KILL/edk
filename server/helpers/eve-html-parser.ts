/**
 * EVE Online HTML Parser for Server-Side Use
 * Adapted from Thessia frontend parser
 */

export interface ConvertEveHtmlOptions {
  /**
   * Whether to convert font size tags (<size=...>)
   * Set to false to allow parent container to control font sizing
   */
  convertFontSize?: boolean;
  /**
   * Whether to convert font color tags (<font color=...>)
   * Set to false to allow parent container to control colors
   */
  convertFontColor?: boolean;
}

/**
 * Converts EVE Online specific HTML content to standard HTML
 * Handles: font tags, color tags, showinfo links, killReport/warReport links, etc.
 */
export function convertEveHtml(
  htmlContent: string,
  options: ConvertEveHtmlOptions = {}
): string {
  if (!htmlContent) return '';

  const { convertFontSize = true, convertFontColor = true } = options;

  try {
    let content = htmlContent;

    // Handle Python/Unicode string format
    if (content.startsWith("u'") && content.endsWith("'")) {
      content = content.slice(2, -1);
    } else if (content.startsWith('u"') && content.endsWith('"')) {
      content = content.slice(2, -1);
    }

    // Replace escaped single quotes
    content = content.replace(/\\'/g, "'");

    // Replace unicode escape sequences
    content = content.replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // Handle <font> tags for color/size in one pass
    if (convertFontColor || convertFontSize) {
      content = content.replace(/<font\b([^>]*)>/gi, (_match, attrs) => {
        const styles: string[] = [];

        if (convertFontColor) {
          const colorMatch = attrs.match(/color=["']?([^"'\s>]+)["']?/i);
          if (colorMatch?.[1]) {
            const raw = colorMatch[1];
            const normalized =
              raw.length === 9 && raw.startsWith('#')
                ? `#${raw.slice(1, 7)}`
                : raw.length === 8 && /^[A-Fa-f0-9]{8}$/.test(raw)
                  ? `#${raw.slice(0, 6)}`
                  : raw;
            styles.push(`color: ${normalized}`);
          }
        }

        if (convertFontSize) {
          const sizeMatch = attrs.match(/size=["']?([^"'\s>]+)["']?/i);
          const size = sizeMatch ? normalizeFontSize(sizeMatch[1]) : null;
          if (size) {
            styles.push(`font-size: ${size}`);
          }
        }

        if (styles.length === 0) {
          return '<span>';
        }

        return `<span style="${styles.join('; ')}">`;
      });

      // Close font tags
      content = content.replace(/<\/font>/gi, '</span>');
    } else {
      // Strip font tags but keep content
      content = content.replace(/<\/?font[^>]*>/gi, '');
    }

    if (convertFontSize) {
      // Size tags
      content = content.replace(
        /<size=["']?([^"'\s>]+)["']?>(.*?)<\/size>/gi,
        (_, size, inner) => {
          const normalizedSize = normalizeFontSize(size);
          return `<span${normalizedSize ? ` style="font-size: ${normalizedSize}"` : ''}>${inner}</span>`;
        }
      );
    } else {
      // Strip size tags but keep content
      content = content.replace(/<\/?size[^>]*>/gi, '');
    }

    if (!convertFontSize) {
      // Remove inline font-size declarations from any remaining style attributes
      content = content.replace(/style=["']([^"']*)["']/gi, (_m, style) => {
        const cleaned = style
          .split(';')
          .map((part) => part.trim())
          .filter((part) => part && !/^font-size\s*:/i.test(part))
          .join('; ');
        return cleaned ? `style="${cleaned}"` : '';
      });
    }

    // Localized tags
    content = content.replace(/<loc>(.*?)<\/loc>/gi, '$1');

    // Color tags
    content = content.replace(
      /<color\s+0x=["']?([A-Fa-f0-9]+)["']?>(.*?)<\/color>/gi,
      (_, hex, text) => {
        const colorValue = `#${hex.slice(2, 8)}`;
        return `<span style="color: ${colorValue}">${text}</span>`;
      }
    );

    // Close color tags properly
    content = content.replace(/<\/color>/gi, '</span>');

    // URL handling with target attribute
    content = content.replace(
      /<url=(.*?)>(.*?)<\/url>/gi,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>'
    );

    // Simple URL
    content = content.replace(
      /<url>(.*?)<\/url>/gi,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Handle killReport and warReport links
    content = content.replace(
      /<a href="killReport:(\d+)(:[A-Fa-f0-9]+)?"[^>]*>([^<]+)<\/a>/g,
      '<a href="/killmail/$1">$3</a>'
    );
    content = content.replace(
      /<a href="warReport:(\d+)"[^>]*>([^<]+)<\/a>/g,
      '<a href="/war/$1">$2</a>'
    );

    // Process showinfo links
    content = content.replace(
      /<a href="(showinfo:[^"]+)"[^>]*>([^<]+)<\/a>/g,
      (_, href, text) => `<a href="${renderEveHref(href)}">${text}</a>`
    );

    // Handle external links (add target="_blank")
    content = content.replace(
      /<a href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>'
    );

    // Replace newlines with <br> tags
    content = content.replace(/\r\n|\r|\n/g, '<br>');

    return content;
  } catch {
    return htmlContent;
  }
}

/**
 * Converts EVE-specific hrefs to website URLs
 */
function renderEveHref(href: string): string {
  const INVENTORY_INFO_PREFIX = 'showinfo:';
  const WAR_REPORT_PREFIX = 'warReport:';
  const KILL_REPORT_PREFIX = 'killReport:';

  const STATION_TYPE_IDS = [
    54, 56, 57, 58, 59, 1529, 1530, 1531, 1926, 1927, 1928, 1929, 1930, 1931,
    1932, 2071, 2496, 2497, 2498, 2499, 2500, 2501, 2502, 3864, 3865, 3866,
    3867, 3868, 3869, 3870, 3871, 3872, 4023, 4024, 9856, 9857, 9867, 9868,
    9873, 10795, 12242, 12294, 12295, 19757, 21642, 21644, 21645, 21646, 22296,
    22297, 22298, 29323, 29387, 29388, 29389, 29390, 34325, 34326, 52678, 59956,
    71361, 74397,
  ];

  const CHARACTER_TYPE_IDS = [
    1373, 1374, 1375, 1376, 1377, 1378, 1379, 1380, 1381, 1382, 1383, 1384,
    1385, 1386, 34574,
  ];

  if (href.startsWith(INVENTORY_INFO_PREFIX)) {
    const targetType = href.slice(INVENTORY_INFO_PREFIX.length).split('//');

    if (targetType.length === 1) {
      return `/item/${targetType[0]}`;
    }

    // Handle different types based on the type ID
    if (targetType[0] === '1') return `/item/${targetType[1]}`; // Item type
    if (targetType[0] === '2') return `/corporation/${targetType[1]}`; // Corporation
    if (targetType[0] === '3') return `/region/${targetType[1]}`; // Region
    if (targetType[0] === '4') return `/constellation/${targetType[1]}`; // Constellation
    if (targetType[0] === '5') return `/system/${targetType[1]}`; // System
    if (targetType[0] === '16159') return `/alliance/${targetType[1]}`; // Alliance
    if (targetType[0] === '35834') return '#'; // Goes to a specific station/citadel

    // Handle special types
    const typeId = parseInt(targetType[0] ?? '');
    if (CHARACTER_TYPE_IDS.includes(typeId))
      return `/character/${targetType[1]}`; // Character types
    if (STATION_TYPE_IDS.includes(typeId)) return `/station/${targetType[1]}`; // Station types
  }

  if (href.startsWith(WAR_REPORT_PREFIX)) {
    const warId = href.slice(WAR_REPORT_PREFIX.length);
    return `/war/${warId}`;
  }

  if (href.startsWith(KILL_REPORT_PREFIX)) {
    const killId = href.split(':')[1];
    return `/killmail/${killId}`;
  }

  return href;
}

/**
 * Decodes Unicode escape sequences in a string
 */
export function decodeUnicodeEscapes(str: string): string {
  return str.replace(/\\u([\dA-F]{4})/gi, (_match, grp) => {
    return String.fromCharCode(parseInt(grp, 16));
  });
}

function normalizeFontSize(rawSize: string): string | null {
  const trimmed = rawSize.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(px|pt|em|rem|%)?$/i);
  if (!match) {
    return null;
  }

  const [, value, unit] = match;
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return null;
  }

  const normalizedUnit = unit ? unit.toLowerCase() : 'px';
  return `${numeric}${normalizedUnit}`;
}
