import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const tables = 'CREATE TABLE workspaces (id text); CREATE TABLE feedback (id text); CREATE TABLE tasks (id text); CREATE TABLE components (id text);'

it('repairs an existing installation that skipped upstream 0049 without resetting old vision settings', async () => {
  const db = new PGlite()
  try {
    await db.exec("CREATE TABLE assets (id text PRIMARY KEY); INSERT INTO assets VALUES ('old'); CREATE TABLE model_accounts (supports_vision boolean NOT NULL DEFAULT false); INSERT INTO model_accounts VALUES (true)")
    await db.exec(tables)
    const migration = await readFile('server/db/migrations/0060_merged_provider_vision.sql', 'utf8')
    await db.exec(migration)
    await db.exec("INSERT INTO assets (id) VALUES ('new')")
    await db.exec(migration)
    expect((await db.query('SELECT id, describe_attempts FROM assets ORDER BY id')).rows).toEqual([{ id: 'new', describe_attempts: 0 }, { id: 'old', describe_attempts: 3 }])
    expect((await db.query('SELECT supports_vision FROM model_accounts')).rows).toEqual([{ supports_vision: true }])
    expect((await db.query("SELECT to_regclass('public.image_description_prefs') AS name")).rows[0]).toMatchObject({ name: 'image_description_prefs' })
    expect((await db.query("SELECT to_regclass('public.custom_agents') AS name")).rows[0]).toMatchObject({ name: 'custom_agents' })
  } finally {
    await db.close()
  }
})

it('applies cleanly to fresh installations where upstream 0049 already ran', async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE TABLE assets (id text PRIMARY KEY); CREATE TABLE model_accounts (id text)')
    await db.exec(tables)
    await db.exec(await readFile('server/db/migrations/0049_image_descriptions.sql', 'utf8'))
    await db.exec(await readFile('server/db/migrations/0060_merged_provider_vision.sql', 'utf8'))
    await db.exec('INSERT INTO model_accounts DEFAULT VALUES')
    expect((await db.query('SELECT supports_vision FROM model_accounts')).rows).toEqual([{ supports_vision: false }])
  } finally {
    await db.close()
  }
})
