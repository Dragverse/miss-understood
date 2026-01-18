#!/usr/bin/env node

/**
 * Deploy database migration to Supabase
 */

const fs = require('fs');
const https = require('https');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Read migration SQL
const migrationSQL = fs.readFileSync('supabase-migration-privacy.sql', 'utf8');

console.log('🚀 Deploying database migration to production...');
console.log('📍 Target:', SUPABASE_URL);
console.log('');

// Split SQL into individual statements
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && s !== '');

let successCount = 0;
let errorCount = 0;

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);

    const options = {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

// Alternative: Use psql if available
const { exec } = require('child_process');

const dbUrl = SUPABASE_URL.replace('https://', '')
  .replace('.supabase.co', '');
const projectRef = dbUrl;

console.log('🔧 Attempting to run migration via psql...');
console.log('');

const psqlCommand = `PGPASSWORD="${SERVICE_ROLE_KEY}" psql "postgresql://postgres.${projectRef}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres" -f supabase-migration-privacy.sql`;

exec(psqlCommand, (error, stdout, stderr) => {
  if (error) {
    console.log('⚠️  psql not available, using alternative method...');
    console.log('');
    console.log('📝 Migration SQL ready. Please run manually in Supabase Dashboard:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql');
    console.log('   2. Copy contents of: supabase-migration-privacy.sql');
    console.log('   3. Paste and click "Run"');
    console.log('');
    console.log('✨ Migration file location: supabase-migration-privacy.sql');
    return;
  }

  console.log('✅ Migration executed successfully!');
  console.log('');
  if (stdout) console.log(stdout);
  if (stderr) console.log('Warnings:', stderr);

  console.log('');
  console.log('🎉 Database migration complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Verify: SELECT table_name FROM information_schema.tables WHERE table_name LIKE \'video%\';');
  console.log('2. Test upload with privacy settings');
  console.log('3. Test share modal');
});
