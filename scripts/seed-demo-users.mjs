#!/usr/bin/env node
/**
 * Crea 5 utenti demo per il pilot DocOps.
 * Password comune: Demo1234!
 *
 * Uso: node scripts/seed-demo-users.mjs
 * Prerequisiti: backend fermo o almeno DB accessibile, .env presente nella root
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leggi DATABASE_URL da .env nella root del progetto
function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const dbUrl = env['DATABASE_URL'];
if (!dbUrl) {
  console.error('DATABASE_URL non trovata nel file .env');
  process.exit(1);
}

const DEMO_PASSWORD = 'Demo1234!';
const SALT_ROUNDS = 12;

const DEMO_USERS = [
  { name: 'Demo PO',       email: 'po@demo.local',       docopsRoles: ['PROCESS_OWNER'] },
  { name: 'Demo Approver', email: 'approver@demo.local',  docopsRoles: ['APPROVER'] },
  { name: 'Demo Dev',      email: 'dev@demo.local',       docopsRoles: ['DEVELOPER'] },
  { name: 'Demo TL',       email: 'tl@demo.local',        docopsRoles: ['TECH_LEAD'] },
  { name: 'Demo Reader',   email: 'reader@demo.local',    docopsRoles: ['READER'] },
];

async function main() {
  // Normalizza URL per postgres.js (rimuove schema=public se presente)
  const cleanUrl = dbUrl.replace(/[?&]schema=[^&]*/g, '').replace(/\?$/, '');
  const sql = postgres(cleanUrl, { ssl: false, max: 1 });

  try {
    // Recupera workspace_id (unico workspace DocOps)
    const workspaces = await sql`SELECT id FROM workspaces LIMIT 1`;
    if (workspaces.length === 0) {
      console.error('Nessun workspace trovato. Completa prima il setup iniziale su http://localhost:5173');
      process.exit(1);
    }
    const workspaceId = workspaces[0].id;
    console.log(`Workspace: ${workspaceId}`);

    // Hash password una volta sola (stesso hash per tutti gli utenti demo)
    console.log(`Hashing password (bcrypt saltRounds=${SALT_ROUNDS})...`);
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

    let created = 0;
    let skipped = 0;

    for (const user of DEMO_USERS) {
      // Controlla se esiste già
      const existing = await sql`
        SELECT id FROM users
        WHERE email = ${user.email} AND workspace_id = ${workspaceId}
      `;

      if (existing.length > 0) {
        console.log(`  SKIP  ${user.email} (già esistente)`);
        skipped++;
        continue;
      }

      await sql`
        INSERT INTO users (
          name,
          email,
          email_verified_at,
          password,
          role,
          workspace_id,
          docops_roles,
          auth_provider
        ) VALUES (
          ${user.name},
          ${user.email},
          NOW(),
          ${passwordHash},
          'member',
          ${workspaceId},
          ${sql.array(user.docopsRoles)},
          'local'
        )
      `;

      console.log(`  OK    ${user.email} → ruoli: ${user.docopsRoles.join(', ')}`);
      created++;
    }

    console.log(`\nDone. Creati: ${created} | Skippati: ${skipped}`);
    console.log(`\nCredenziali demo:`);
    for (const u of DEMO_USERS) {
      console.log(`  ${u.email.padEnd(25)} password: ${DEMO_PASSWORD}`);
    }

  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Errore:', err.message);
  process.exit(1);
});
