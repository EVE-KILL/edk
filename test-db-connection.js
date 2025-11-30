const postgres = require('postgres').default || require('postgres');

const url = process.env.DATABASE_URL || 'postgresql://evekill:edk_password@postgres-rw:5432/evekill?sslmode=disable';
console.log('Testing connection to:', url.replace(/:([^:@]+)@/, ':****@'));

const sql = postgres(url, {
  max: 1,
  connect_timeout: 10,
});

sql`SELECT 1 as test, current_database() as db, current_user as user`
  .then(result => {
    console.log('✅ SUCCESS! Connected to PostgreSQL');
    console.log('Result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ ERROR connecting to PostgreSQL:');
    console.error(error.message);
    console.error('Full error:', error);
    process.exit(1);
  });
