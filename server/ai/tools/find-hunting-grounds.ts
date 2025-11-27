/**
 * Find Hunting Ground Hotspots
 * Analyzes recent killmail activity to find active PvP systems
 */

import type { AITool, AIToolResult, AIToolContext } from '../types';

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'find_hunting_grounds',
    description:
      'Find active PvP hunting ground hotspots by analyzing recent killmail activity. Returns systems ranked by kill count and total ISK destroyed. Great for finding "where to hunt" or "active systems".',
    parameters: {
      type: 'object',
      properties: {
        security_status: {
          type: 'string',
          enum: ['null', 'low', 'high', 'all'],
          description:
            'Filter by security: "null" (nullsec ≤0.0), "low" (lowsec 0.0-0.5), "high" (highsec ≥0.5), or "all" (no filter). Defaults to "all".',
        },
        timeframe: {
          type: 'string',
          enum: ['1h', '6h', '12h', '24h', '48h', '7d'],
          description:
            'Time window to analyze activity. Defaults to "6h". Use shorter periods for current hotspots, longer for sustained activity.',
        },
        min_value: {
          type: 'number',
          description:
            'Minimum total ISK destroyed in billions (e.g., 1 = 1B ISK). Filter out low-value systems. Optional.',
        },
        min_kills: {
          type: 'number',
          description:
            'Minimum kill count required for a system to be included. Defaults to 5. Increase for busier hotspots.',
        },
        limit: {
          type: 'number',
          description:
            'Maximum number of hotspots to return (1-20). Defaults to 10.',
          minimum: 1,
          maximum: 20,
        },
      },
      required: [],
    },
  },
};

const TIMEFRAME_HOURS: Record<string, number> = {
  '1h': 1,
  '6h': 6,
  '12h': 12,
  '24h': 24,
  '48h': 48,
  '7d': 168,
};

export async function execute(
  args: any,
  context: AIToolContext
): Promise<AIToolResult> {
  try {
    const timeframe = args.timeframe || '6h';
    const securityStatus = args.security_status || 'all';
    const limit = Math.min(Math.max(args.limit || 10, 1), 20);
    const minValue = args.min_value ? args.min_value * 1_000_000_000 : 0; // Convert billions to raw ISK
    const minKills = args.min_kills || 5;

    const hours = TIMEFRAME_HOURS[timeframe] || 6;
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    context.logger.debug('[find-hunting-grounds] Searching for hotspots', {
      timeframe,
      securityStatus,
      minValue,
      minKills,
      limit,
    });

    const sql = context.database.sql;

    // Build security filter
    let securityCondition = '';
    if (securityStatus === 'null') {
      securityCondition = 'AND s."securityStatus" <= 0.0';
    } else if (securityStatus === 'low') {
      securityCondition =
        'AND s."securityStatus" > 0.0 AND s."securityStatus" < 0.5';
    } else if (securityStatus === 'high') {
      securityCondition = 'AND s."securityStatus" >= 0.5';
    }

    // Query to find hotspots
    const query = `
      SELECT 
        k."solarSystemId",
        s."name" as system_name,
        s."securityStatus" as security,
        r."name" as region_name,
        COUNT(*) as kill_count,
        SUM(k."totalValue") as total_value,
        AVG(k."totalValue") as avg_value,
        MAX(k."totalValue") as max_value,
        MIN(k."killmailTime") as first_kill,
        MAX(k."killmailTime") as last_kill
      FROM killmails k
      JOIN solarsystems s ON k."solarSystemId" = s."solarSystemId"
      JOIN regions r ON s."regionId" = r."regionId"
      WHERE k."killmailTime" >= $1
        AND k."npc" = false
        ${securityCondition}
      GROUP BY k."solarSystemId", s."name", s."securityStatus", r."name"
      HAVING COUNT(*) >= $2
        AND SUM(k."totalValue") >= $3
      ORDER BY COUNT(*) DESC, SUM(k."totalValue") DESC
      LIMIT $4
    `;

    const hotspots = await sql.unsafe(query, [
      cutoffTime,
      minKills,
      minValue,
      limit,
    ]);

    if (hotspots.length === 0) {
      return {
        html: `
          <div style="padding: 16px; background: #2a2a2a; border-radius: 8px; margin: 16px 0;">
            <div style="color: #999;">No active hunting grounds found with current filters.</div>
            <div style="color: #666; margin-top: 8px; font-size: 13px;">
              Try adjusting your filters or timeframe.
            </div>
          </div>
        `,
        stats: {
          hotspots_found: 0,
          timeframe,
          security_status: securityStatus,
        },
      };
    }

    // Calculate stats
    const totalKills = hotspots.reduce(
      (sum, h) => sum + Number(h.kill_count),
      0
    );
    const totalValue = hotspots.reduce(
      (sum, h) => sum + Number(h.total_value),
      0
    );

    // Build HTML
    const hotspotsHtml = hotspots
      .map((hotspot, index) => {
        const security = Number(hotspot.security).toFixed(1);
        const securityColor = getSecurityColor(Number(hotspot.security));
        const killCount = Number(hotspot.kill_count);
        const totalVal = Number(hotspot.total_value);
        const avgVal = Number(hotspot.avg_value);
        const maxVal = Number(hotspot.max_value);

        // Time since first/last kill
        const firstKill = new Date(hotspot.first_kill);
        const lastKill = new Date(hotspot.last_kill);
        const timeSinceLastKill = getTimeAgo(lastKill);

        // Activity indicator (kills per hour)
        const activityDuration =
          (lastKill.getTime() - firstKill.getTime()) / (1000 * 60 * 60);
        const killsPerHour =
          activityDuration > 0 ? killCount / activityDuration : killCount;
        const activityLevel = getActivityLevel(killsPerHour);

        return `
          <div style="
            padding: 16px;
            background: ${index % 2 === 0 ? '#1a1a1a' : '#252525'};
            border-left: 4px solid ${securityColor};
            margin-bottom: 8px;
            border-radius: 4px;
          ">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
              <div style="flex: 1;">
                <div style="font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 4px;">
                  #${index + 1} ${hotspot.system_name}
                  <span style="color: ${securityColor}; margin-left: 8px;">${security}</span>
                </div>
                <div style="color: #999; font-size: 13px;">
                  ${hotspot.region_name}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="
                  display: inline-block;
                  padding: 4px 12px;
                  background: ${activityLevel.color};
                  color: #fff;
                  border-radius: 12px;
                  font-size: 12px;
                  font-weight: 600;
                ">
                  ${activityLevel.label}
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;">
              <div>
                <div style="color: #888; font-size: 12px; margin-bottom: 4px;">Kills</div>
                <div style="color: #fff; font-size: 16px; font-weight: 600;">
                  ${killCount.toLocaleString()}
                </div>
              </div>
              <div>
                <div style="color: #888; font-size: 12px; margin-bottom: 4px;">Total Value</div>
                <div style="color: #4caf50; font-size: 16px; font-weight: 600;">
                  ${formatISK(totalVal)}
                </div>
              </div>
              <div>
                <div style="color: #888; font-size: 12px; margin-bottom: 4px;">Avg Value</div>
                <div style="color: #aaa; font-size: 14px;">
                  ${formatISK(avgVal)}
                </div>
              </div>
              <div>
                <div style="color: #888; font-size: 12px; margin-bottom: 4px;">Biggest Kill</div>
                <div style="color: #ff9800; font-size: 14px;">
                  ${formatISK(maxVal)}
                </div>
              </div>
            </div>

            <div style="border-top: 1px solid #333; padding-top: 8px; margin-top: 8px;">
              <div style="color: #666; font-size: 12px;">
                Last activity: ${timeSinceLastKill} • ${killsPerHour.toFixed(1)} kills/hour
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    const html = `
      <div style="margin: 16px 0;">
        <h3 style="color: #fff; margin-bottom: 4px; font-size: 18px;">
          🎯 Hunting Ground Hotspots
        </h3>
        <div style="color: #888; font-size: 13px; margin-bottom: 16px;">
          ${timeframe} • ${securityStatus} sec • Found ${hotspots.length} active systems
        </div>
        <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div>
              <div style="color: #888; font-size: 12px; margin-bottom: 4px;">Total Hotspots</div>
              <div style="color: #fff; font-size: 20px; font-weight: 600;">${hotspots.length}</div>
            </div>
            <div>
              <div style="color: #888; font-size: 12px; margin-bottom: 4px;">Combined Kills</div>
              <div style="color: #fff; font-size: 20px; font-weight: 600;">${totalKills.toLocaleString()}</div>
            </div>
            <div>
              <div style="color: #888; font-size: 12px; margin-bottom: 4px;">Combined Value</div>
              <div style="color: #4caf50; font-size: 20px; font-weight: 600;">${formatISK(totalValue)}</div>
            </div>
          </div>
        </div>
        ${hotspotsHtml}
      </div>
    `;

    return {
      html,
      stats: {
        hotspots_found: hotspots.length,
        total_kills: totalKills,
        total_value_isk: totalValue,
        timeframe,
        security_status: securityStatus,
        top_system: hotspots[0]
          ? {
              name: hotspots[0].system_name,
              region: hotspots[0].region_name,
              kills: Number(hotspots[0].kill_count),
              value: Number(hotspots[0].total_value),
            }
          : null,
      },
    };
  } catch (error) {
    context.logger.error('[find-hunting-grounds] Error:', error);
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to find hunting grounds',
      stats: {
        error: true,
      },
    };
  }
}

function getSecurityColor(security: number): string {
  if (security >= 0.5) return '#2ecc71'; // High sec - green
  if (security > 0.0) return '#f39c12'; // Low sec - orange
  return '#e74c3c'; // Null sec - red
}

function getActivityLevel(killsPerHour: number): {
  label: string;
  color: string;
} {
  if (killsPerHour >= 10) return { label: '🔥 VERY HOT', color: '#e74c3c' };
  if (killsPerHour >= 5) return { label: '🔥 HOT', color: '#ff9800' };
  if (killsPerHour >= 2) return { label: '⚡ ACTIVE', color: '#2196f3' };
  return { label: '📍 WARM', color: '#666' };
}

function formatISK(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  return `${value.toLocaleString()} ISK`;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
