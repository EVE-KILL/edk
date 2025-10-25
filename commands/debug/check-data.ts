import { database } from '../../server/helpers/database';

export default {
  description: 'Debug: Check raw data in database for a specific killmail',
  options: [
    {
      flags: '-i, --id <killmail_id>',
      description: 'The killmail ID to check'
    }
  ],
  async action(options: { id?: string }) {
    if (!options.id) {
      console.error('❌ Usage: bun run cli debug:check-data --id <killmail_id>')
      return
    }

    const killmailId = parseInt(options.id, 10);

    console.log(`\n📊 Checking data for killmail ${killmailId}...\n`);

    try {
      // Check killmail
      const killmail = await database.query(
        `SELECT * FROM edk.killmails WHERE killmailId = ${killmailId}`
      );

      console.log('✅ Killmail exists:', killmail.length > 0);
      if (killmail.length > 0) {
        console.log(JSON.stringify(killmail[0], null, 2));
      }

      // Check attackers
      const attackers = await database.query(
        `SELECT COUNT(*) as count FROM edk.attackers WHERE killmailId = ${killmailId}`
      );

      console.log('\n✅ Attackers count:');
      console.log(JSON.stringify(attackers, null, 2));

      // Check items
      const items = await database.query(
        `SELECT COUNT(*) as count FROM edk.items WHERE killmailId = ${killmailId}`
      );

      console.log('\n✅ Items count:');
      console.log(JSON.stringify(items, null, 2));

      // Check materialized view data
      const viewData = await database.query(
        `SELECT
          killmail_id,
          killmail_time,
          length(attackers_array) as attacker_count,
          length(items_array) as item_count,
          attackers_array,
          items_array
        FROM edk.killmails_esi WHERE killmail_id = ${killmailId}`
      );

      // Test the subqueries separately
      console.log('\n✅ Testing attackers subquery:');
      const attackersSubquery = await database.query(
        `SELECT
          killmailId,
          groupArray(
            tuple(
              allianceId,
              characterId,
              corporationId,
              damageDone,
              finalBlow,
              securityStatus,
              shipTypeId,
              weaponTypeId
            )
          ) as attackers_array
        FROM edk.attackers
        WHERE killmailId = ${killmailId}
        GROUP BY killmailId`
      );
      console.log(JSON.stringify(attackersSubquery, null, 2));

      console.log('\n✅ Testing items subquery:');
      const itemsSubquery = await database.query(
        `SELECT
          killmailId,
          groupArray(
            tuple(
              flag,
              itemTypeId,
              quantityDropped,
              quantityDestroyed,
              singleton
            )
          ) as items_array
        FROM edk.items
        WHERE killmailId = ${killmailId}
        GROUP BY killmailId`
      );
      console.log(JSON.stringify(itemsSubquery, null, 2));

      console.log('\n✅ Materialized view data:');
      if (viewData.length > 0) {
        console.log(JSON.stringify(viewData[0], null, 2));
      } else {
        console.log('⚠️  No view data found!');
      }
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }
}
