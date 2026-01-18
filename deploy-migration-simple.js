#!/usr/bin/env node

/**
 * Simple migration deployer using psql
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not parse Supabase URL');
  process.exit(1);
}

console.log('🚀 Deploying database migration to production...');
console.log('📍 Project:', projectRef);
console.log('');

// Try to use psql
try {
  console.log('🔧 Running migration with psql...');

  const dbHost = `aws-0-us-east-1.pooler.supabase.com`;
  const dbPort = '6543';
  const dbName = 'postgres';
  const dbUser = `postgres.${projectRef}`;

  const command = `PGPASSWORD="${SERVICE_ROLE_KEY}" psql -h ${dbHost} -p ${dbPort} -U "${dbUser}" -d ${dbName} -f supabase-migration-privacy.sql`;

  const output = execSync(command, {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  console.log('✅ Migration executed successfully!');
  console.log('');
  console.log(output);
  console.log('');
  console.log('🎉 Database migration complete!');

} catch (error) {
  console.log('⚠️  Could not run psql automatically');
  console.log('');
  console.log('📋 Manual deployment required:');
  console.log('');
  console.log('1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql');
  console.log('2. Copy the contents of: supabase-migration-privacy.sql');
  console.log('3. Paste into SQL Editor');
  console.log('4. Click "Run"');
  console.log('');
  console.log('Or install psql: brew install postgresql');
  console.log('');
}
