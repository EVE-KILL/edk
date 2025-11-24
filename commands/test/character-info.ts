import { logger } from '../../server/helpers/logger';

import { database } from '../../server/helpers/database';
import { getCharacterInfo } from '../../server/models/characters';

export default {
  description: 'Test fetching character information',
  options: [
    {
      flags: '-i, --id <characterId>',
      description: 'Character ID to test',
      defaultValue: '95590706',
    },
  ],
  async action(options: { id: string }) {
    const characterId = Number.parseInt(options.id);

    logger.info(`\n🔍 Testing character info fetch for ID: ${characterId}\n`);

    // Test the basic query first
    logger.info('📊 Testing basic character query...');

    const basicQuery = await database.find<any>(
      `SELECT
         c.name as "characterName",
         a."corporationId" as "corporationId",
         corp.name as "corporationName",
         corp."tickerName" as "corporationTicker",
         a."allianceId" as "allianceId",
         alliance.name as "allianceName",
         alliance."tickerName" as "allianceTicker",
         k."killmailTime" as "lastSeen"
       FROM attackers a
       LEFT JOIN killmails k ON a."killmailId" = k."killmailId"
       LEFT JOIN characters c ON a."characterId" = c."characterId"
       LEFT JOIN npcCorporations corp ON a."corporationId" = corp."corporationId"
       LEFT JOIN npcCorporations alliance ON a."allianceId" = alliance."corporationId"
       WHERE a."characterId" = :characterId
       LIMIT 5`,
      { characterId }
    );

    logger.info('Results from attackers (kills):', basicQuery.length, 'rows');
    if (basicQuery.length > 0) {
      logger.info('Sample:', JSON.stringify(basicQuery[0], null, 2));
    }

    const lossQuery = await database.find<any>(
      `SELECT
         c.name as "characterName",
         k."victimCorporationId" as "corporationId",
         corp.name as "corporationName",
         corp."tickerName" as "corporationTicker",
         k."victimAllianceId" as "allianceId",
         alliance.name as "allianceName",
         alliance."tickerName" as "allianceTicker",
         k."killmailTime" as "lastSeen"
       FROM killmails k
       LEFT JOIN characters c ON k."victimCharacterId" = c."characterId"
       LEFT JOIN npcCorporations corp ON k."victimCorporationId" = corp."corporationId"
       LEFT JOIN npcCorporations alliance ON k."victimAllianceId" = alliance."corporationId"
       WHERE k."victimCharacterId" = :characterId
       LIMIT 5`,
      { characterId }
    );

    logger.info('\nResults from killmails (losses):', lossQuery.length, 'rows');
    if (lossQuery.length > 0) {
      logger.info('Sample:', JSON.stringify(lossQuery[0], null, 2));
    }

    // Test the full getCharacterInfo function
    logger.info('\n📋 Testing getCharacterInfo() function...');
    try {
      const characterInfo = await getCharacterInfo(characterId);

      if (characterInfo) {
        logger.info('✅ Character found!');
        logger.info(JSON.stringify(characterInfo, null, 2));
      } else {
        logger.info('❌ Character not found (returned null)');
      }
    } catch (error) {
      logger.error('❌ Error:', error);
    }

    // Test stats query
    logger.info('\n📈 Testing stats query...');
    const statsQuery = await database.findOne<{
      kills: number;
      losses: number;
    }>(
      `SELECT
         (SELECT count(*) FROM attackers WHERE "characterId" = :characterId) as kills,
         (SELECT count(*) FROM killmails WHERE "victimCharacterId" = :characterId) as losses`,
      { characterId }
    );

    logger.info('Stats:', statsQuery);

    logger.info('\n✅ Test complete\n');
    process.exit(0);
  },
};
