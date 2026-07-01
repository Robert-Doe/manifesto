# Module 08 — Design Decisions

## Decision 1: Migrations are keyed by target version, not by migration index

**Choice:** `const MIGRATIONS = { '0.8.0': async (storage) => { ... } }` — each key is the version that introduced the change.

**Rejected:** A flat array of migration functions in sequence order.

**Why version keys:**
- The migration runner can determine which migrations to run by comparing version strings: run migrations where `previousVersion < target <= currentVersion`.
- A developer who opens a PR adding version 0.9.0 features adds a `'0.9.0'` key. The code clearly communicates what was added when.
- Users who install the extension fresh (no `previousVersion`) get all migrations run. Users upgrading from 0.6.0 get only `0.7.0` and `0.8.0` migrations. Users who skip from 0.5.0 to 0.8.0 get all three — correctly.
- Array indices break this: if migration 3 needs to know whether the user already ran migration 2, you need out-of-band tracking. Version keys make the ordering self-documenting.

---

## Decision 2: migrationLog persists in chrome.storage.local, not session storage

**Choice:** `{ migrationLog: [...], schemaVersion: '0.8.0' }` in `chrome.storage.local`.

**Why persistence is required:**
- Migrations must be idempotent. If the service worker dies after running migration 0.8.0 but before the migration log is updated, the migration would re-run on the next startup. The log prevents double-runs.
- `chrome.storage.session` is cleared on browser restart — exactly when re-runs are most likely (user restarts Chrome, extension re-initializes, `onInstalled` fires again with `reason: 'install'`? No — `onInstalled` fires only once per actual install/update. But without a persistent log, we cannot prove a migration ran if the SW was killed mid-write).
- The log is capped at 50 entries. Each entry is ~50 bytes, so the full log is 2.5 KB maximum. Storage budget impact is negligible.

---

## Decision 3: onInstalled reason routing is the correct place for migration logic

**Choice:** All migration logic lives in the `chrome.runtime.onInstalled` listener, branching on `reason`.

**Why onInstalled, not onStartup:**
- `onInstalled` fires exactly once when the extension is installed (`reason: 'install'`), updated (`reason: 'update'`), or Chrome updates (`reason: 'chrome_update'`).
- `onStartup` fires every time Chrome starts, including sessions where nothing changed. Running migrations on startup would require additional guards to prevent re-runs.
- The `previousVersion` field (available only on `reason === 'update'`) gives you the exact version the user was on before upgrading. There is no equivalent on startup.

**The `chrome_update` case:**
When Chrome updates, the service worker is reloaded but the extension version has not changed. No storage schema migrations are needed. The handler logs the event for diagnostics but does nothing to storage.

---

## Decision 4: Migrations receive the current storage snapshot as an argument

**Choice:** `const storage = await StorageManager.get(null)` runs once before all migrations, and the result is passed to each migration function.

**Why pass the snapshot:**
- Avoids N separate storage reads for N migrations — one read covers all.
- Each migration can inspect the current state to make decisions (e.g., only set a default if the key does not already exist — idempotency).
- Migrations that need to write back do so via `StorageManager.set()`, which is atomic per key.

**Why the idempotency check matters:**
If a user installs version 0.8.0 directly from the Chrome Web Store (no previous version), `MigrationManager.run(null, '0.8.0')` runs all migrations. Migration 0.7.0 checks `if (!storage.historyVisitCount)` — since this is a fresh install, the key does not exist, so it sets the default. On a subsequent reload (not an update), `run` is not called. But if it were called accidentally, the check would see `historyVisitCount` already set and skip the write. Correct behavior in both cases without an explicit `alreadyRan` guard.

---

## Decision 5: The Simulate Update button in update_log.html is a teaching tool, not a production feature

**Choice:** A button that calls `runMigrations({ fromVersion: '0.5.0' })` exists in the development UI.

**Why this exists:**
- It is impossible to trigger `onInstalled` programmatically in production — Chrome fires it only on real installs and updates.
- Without a simulation path, the migration system cannot be demonstrated in a running extension without actually shipping two different versions and updating.
- The simulate button calls `MigrationManager.run('0.5.0', currentVersion)` directly, which exercises the full migration path for versions 0.6.0, 0.7.0, and 0.8.0.

**What to remove before shipping:**
In a real extension, this button and the `runMigrations` message handler would be removed or gated behind a developer mode check. Allowing arbitrary migration re-runs in production could corrupt storage if a user clicks it after the migration has already transformed their data.

---

## Decision 6: Version comparison uses a 3-component numeric sort, not lexicographic sort

**Choice:** `compareVersions('0.10.0', '0.9.0')` returns 1 (10 > 9).

**Why this matters:**
Lexicographic comparison would return -1 ('1' < '9'). This is a common bug in versioning code that becomes a real problem when extensions cross the 0.9.x → 0.10.x boundary. NeuralTab's `compareVersions` splits on `.` and compares each component as an integer.
