/**
 * Bootstrap tasks that run before the main server starts.
 * Replaces entrypoint.sh logic:
 *  - Download spleeter 2stems model if missing
 *  - Fix migration numbering for databases upgraded from old Karaoke Forever
 *  - Symlink pretrained_models
 */
import fs from 'fs'
import path from 'path'
import { execFileSync, execSync } from 'child_process'
import { DatabaseSync } from 'node:sqlite'
import getLogger from './lib/Log.js'

let log: ReturnType<typeof getLogger>
function getLog () {
  if (!log) log = getLogger('bootstrap')
  return log
}

/**
 * Ensure the spleeter 2stems model is downloaded to persistent storage.
 */
function ensureSpleeterModel (tmpDir: string) {
  const modelDir = path.join(tmpDir, 'pretrained_models', '2stems')
  const checkpoint = path.join(modelDir, 'checkpoint')

  if (!fs.existsSync(checkpoint)) {
    getLog().info('Downloading spleeter 2stems model...')
    fs.mkdirSync(modelDir, { recursive: true })

    const tarball = '/tmp/2stems.tar.gz'
    execFileSync('curl', ['-L', '-o', tarball,
      'https://github.com/deezer/spleeter/releases/download/v1.4.0/2stems.tar.gz'])
    execFileSync('tar', ['xzf', tarball, '-C', modelDir])

    try { fs.unlinkSync(tarball) } catch { /* ignore */ }
    getLog().info('Spleeter model downloaded.')
  }

  // Symlink so spleeter finds models at /app/pretrained_models
  const appModels = path.resolve('pretrained_models')
  try { fs.rmSync(appModels, { recursive: true, force: true }) } catch { /* ignore */ }
  fs.symlinkSync(path.join(tmpDir, 'pretrained_models'), appModels)
}

/**
 * Fix migration numbering for databases upgraded from old Karaoke Forever.
 * Old schema had youtube migration as id=3, new schema has it as id=6.
 */
function fixMigrations (dbPath: string) {
  if (!fs.existsSync(dbPath)) return

  const db = new DatabaseSync(dbPath)

  try {
    const row = db.prepare('SELECT id, name FROM migrations WHERE id = 3').get() as any
    if (row && row.name === 'youtube') {
      getLog().info('Migrating old youtube entry from id=3 to id=6...')
      const oldRow = db.prepare('SELECT * FROM migrations WHERE id = 3').get() as any
      db.exec('DELETE FROM migrations WHERE id = 3')
      db.prepare('INSERT INTO migrations (id, name, up, down) VALUES (6, ?, ?, ?)').run(
        oldRow.name, oldRow.up, oldRow.down
      )

      // Add prevQueueId for queue-linked-list (new migration 3)
      try { db.exec('ALTER TABLE queue ADD COLUMN prevQueueId INTEGER') } catch { /* already exists */ }
      try {
        db.exec('CREATE INDEX IF NOT EXISTS idxPrevQueueId ON queue (prevQueueId ASC)')
        db.exec('UPDATE queue SET prevQueueId = (SELECT MAX(q.queueId) FROM queue q WHERE q.queueId < queue.queueId AND q.roomId = queue.roomId)')
        db.prepare('INSERT INTO migrations (id, name, up, down) VALUES (3, ?, ?, ?)').run(
          'queue-linked-list',
          'ALTER TABLE queue ADD COLUMN prevQueueId INTEGER',
          'ALTER TABLE queue DROP COLUMN prevQueueId'
        )
      } catch (e: any) {
        getLog().info('queue-linked-list already applied or error: ' + e.message)
      }
      getLog().info('Migration renumbering complete.')
    }

    // Apply roles migration (5) if missing
    const mig5 = db.prepare('SELECT id FROM migrations WHERE id = 5').get() as any
    if (!mig5) {
      getLog().info('Applying roles migration (5)...')
      db.exec("CREATE TABLE IF NOT EXISTS roles (roleId integer PRIMARY KEY AUTOINCREMENT NOT NULL, name text NOT NULL COLLATE NOCASE, data text NOT NULL DEFAULT('{}'))")
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idxName ON roles (name ASC)')
      db.exec("INSERT OR IGNORE INTO roles (name) VALUES ('admin'), ('player'), ('standard'), ('guest')")
      try { db.exec('ALTER TABLE users ADD COLUMN roleId integer NOT NULL DEFAULT 0') } catch { /* already exists */ }
      db.exec("UPDATE users SET roleId = CASE WHEN isAdmin = 1 THEN (SELECT roleId FROM roles WHERE name = 'admin') ELSE (SELECT roleId FROM roles WHERE name = 'standard') END")
      try { db.exec('ALTER TABLE users DROP COLUMN isAdmin') } catch { /* already dropped */ }
      db.prepare('INSERT INTO migrations (id, name, up, down) VALUES (5, ?, ?, ?)').run(
        'roles',
        'CREATE TABLE roles ...',
        'DROP TABLE roles'
      )
      getLog().info('Applied roles migration (5).')
    }
  } catch {
    // No migrations table yet or other issue — fresh DB, nothing to fix
  }

  db.close()
}

/**
 * Run all bootstrap tasks before the server starts.
 */
export function bootstrap (env: { KES_PATH_DATA: string, [key: string]: any }) {
  const tmpDir = path.resolve('tmp')
  const dbPath = path.join(env.KES_PATH_DATA, 'database.sqlite3')

  ensureSpleeterModel(tmpDir)
  fixMigrations(dbPath)

  getLog().info('Bootstrap complete.')
}
