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

    console.log(`\n🔍 Testing character info fetch for ID: ${characterId}\n`);

    // Test the basic query first
    console.log('📊 Testing basic character query...');

    const basicQuery = await database.sql<any[]>`
    SELECT
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
    WHERE a."characterId" = ${characterId}
    LIMIT 5
  `;

    console.log('Results from attackers (kills):', basicQuery.length, 'rows');
    if (basicQuery.length > 0) {
      console.log('Sample:', JSON.stringify(basicQuery[0], null, 2));
    }

    const lossQuery = await database.sql<any[]>`
    SELECT
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
    WHERE k."victimCharacterId" = ${characterId}
    LIMIT 5
  `;

    console.log('\nResults from killmails (losses):', lossQuery.length, 'rows');
    if (lossQuery.length > 0) {
      console.log('Sample:', JSON.stringify(lossQuery[0], null, 2));
    }

    // Test the full getCharacterInfo function
    console.log('\n📋 Testing getCharacterInfo() function...');
    try {
      const characterInfo = await getCharacterInfo(characterId);

      if (characterInfo) {
        console.log('✅ Character found!');
        console.log(JSON.stringify(characterInfo, null, 2));
      } else {
        console.log('❌ Character not found (returned null)');
      }
    } catch (error) {
      console.error('❌ Error:', error);
    }

    // Test stats query
    console.log('\n📈 Testing stats query...');
    const [statsQuery] = await database.sql<
      { kills: number; losses: number }[]
    >`
    SELECT
      (SELECT count(*) FROM attackers WHERE "characterId" = ${characterId}) as kills,
      (SELECT count(*) FROM killmails WHERE "victimCharacterId" = ${characterId}) as losses
  `;

    console.log('Stats:', statsQuery);

    console.log('\n✅ Test complete\n');
  },
};
