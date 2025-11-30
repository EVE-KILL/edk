import type { AIToolDefinition, AIToolResult, AIToolContext } from '../types';
import { convertEveHtml } from '../../helpers/eve-html-parser';
import { getCharacter, searchCharacters } from '../../models/characters';
import { getCorporation } from '../../models/corporations';
import { getAlliance } from '../../models/alliances';

export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'show_character_info',
    description:
      'Display detailed character information with portrait image, corp/alliance affiliation, security status, and biography. Use for "show me character X", "who is player Y", or when you need to display a character with their portrait.',
    parameters: {
      type: 'object',
      properties: {
        character_id: {
          type: 'number',
          description:
            'Exact character ID if known. More precise than name search.',
        },
        character_name: {
          type: 'string',
          description:
            'Character name to search for. Partial matches supported.',
        },
      },
      required: [],
    },
  },
};

export async function execute(
  params: {
    character_id?: number;
    character_name?: string;
  },
  _context: AIToolContext
): Promise<AIToolResult> {
  try {
    let character: any = null;

    // Direct lookup by ID
    if (params.character_id) {
      character = await getCharacter(params.character_id);
    }
    // Search by name
    else if (params.character_name) {
      const results = await searchCharacters(params.character_name, 1);
      if (results.length > 0) {
        character = results[0];
      }
    }

    if (!character) {
      return {
        html: `<div style="color: #999;">Character not found</div>`,
        stats: { found: false },
      };
    }

    // Fetch related entities
    const corporation = character.corporationId
      ? await getCorporation(character.corporationId)
      : null;

    const alliance = corporation?.allianceId
      ? await getAlliance(corporation.allianceId)
      : null;

    return {
      html: renderCharacterCard(character, corporation, alliance),
      stats: {
        found: true,
        character_id: character.characterId,
        character_name: character.name,
        corporation: corporation?.name,
        alliance: alliance?.name,
      },
    };
  } catch (error: any) {
    return {
      html: `<div style="color: #f44;">Error fetching character info: ${error.message}</div>`,
      stats: { error: error.message },
    };
  }
}

function renderCharacterCard(
  character: any,
  corporation: any,
  alliance: any
): string {
  const portraitUrl = `https://images.eve-kill.com/characters/${character.characterId}/portrait?size=256`;
  const corpLogoUrl = corporation
    ? `https://images.eve-kill.com/corporations/${corporation.corporationId}/logo?size=128`
    : null;
  const allianceLogoUrl = alliance
    ? `https://images.eve-kill.com/alliances/${alliance.allianceId}/logo?size=128`
    : null;

  const description = character.description
    ? convertEveHtml(character.description, {
        convertFontSize: false,
        convertFontColor: false,
      })
    : null;

  return `
    <div style="
      margin: 16px 0;
      background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
      border: 1px solid #333;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    ">
      <div style="display: flex; gap: 24px; align-items: start;">
        <!-- Character Portrait -->
        <div style="flex-shrink: 0;">
          <img
            src="${portraitUrl}"
            alt="${character.name}"
            style="
              width: 180px;
              height: 180px;
              border-radius: 12px;
              background: #000;
              border: 3px solid #444;
              box-shadow: 0 4px 8px rgba(0,0,0,0.6);
            "
          />
        </div>

        <!-- Character Info -->
        <div style="flex: 1; min-width: 0;">
          <!-- Name -->
          <h2 style="
            color: #fff;
            margin: 0 0 12px 0;
            font-size: 32px;
            font-weight: 700;
          ">
            ${character.name}
          </h2>

          <!-- Corporation & Alliance -->
          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
            ${
              corporation
                ? `
              <div style="display: flex; align-items: center; gap: 12px;">
                ${
                  corpLogoUrl
                    ? `
                  <img
                    src="${corpLogoUrl}"
                    alt="${corporation.name}"
                    style="
                      width: 48px;
                      height: 48px;
                      border-radius: 6px;
                      background: #000;
                      border: 1px solid #555;
                    "
                  />
                `
                    : ''
                }
                <div>
                  <div style="color: #666; font-size: 11px; text-transform: uppercase;">Corporation</div>
                  <div style="color: #0af; font-size: 16px; font-weight: 600;">
                    ${corporation.name}
                  </div>
                </div>
              </div>
            `
                : ''
            }

            ${
              alliance
                ? `
              <div style="display: flex; align-items: center; gap: 12px;">
                ${
                  allianceLogoUrl
                    ? `
                  <img
                    src="${allianceLogoUrl}"
                    alt="${alliance.name}"
                    style="
                      width: 48px;
                      height: 48px;
                      border-radius: 6px;
                      background: #000;
                      border: 1px solid #555;
                    "
                  />
                `
                    : ''
                }
                <div>
                  <div style="color: #666; font-size: 11px; text-transform: uppercase;">Alliance</div>
                  <div style="color: #fa0; font-size: 16px; font-weight: 600;">
                    ${alliance.name}
                  </div>
                </div>
              </div>
            `
                : ''
            }
          </div>

          <!-- Description -->
          ${
            description
              ? `
            <div style="
              color: #999;
              font-size: 12px;
              line-height: 1.6;
              margin-top: 16px;
              padding: 16px;
              background: #0d0d0d;
              border-radius: 8px;
              border-left: 3px solid #0af;
              max-height: 300px;
              overflow-y: auto;
            ">
              ${description}
            </div>
          `
              : ''
          }

          <!-- Character Details -->
          <div style="
            margin-top: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            padding-top: 16px;
            border-top: 1px solid #333;
          ">
            ${
              character.securityStatus !== null &&
              character.securityStatus !== undefined
                ? `
              <div>
                <div style="color: #666; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">
                  Security Status
                </div>
                <div style="
                  color: ${character.securityStatus >= 0 ? '#0f0' : '#f00'};
                  font-size: 18px;
                  font-weight: 700;
                ">
                  ${Number(character.securityStatus).toFixed(2)}
                </div>
              </div>
            `
                : ''
            }

            ${
              character.birthday
                ? `
              <div>
                <div style="color: #666; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">
                  Birthday
                </div>
                <div style="color: #ccc; font-size: 14px;">
                  ${new Date(character.birthday).toLocaleDateString()}
                </div>
              </div>
            `
                : ''
            }

            <div>
              <div style="color: #666; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">
                Character ID
              </div>
              <div style="color: #888; font-size: 14px; font-family: monospace;">
                ${character.characterId}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
