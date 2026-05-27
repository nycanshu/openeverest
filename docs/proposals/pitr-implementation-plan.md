# PITR & Restore from PITR — Implementation Plan

> **Scope:** Full implementation of PITR (Point-in-Time Recovery) across the V2 UI and
> the PSMDB provider. Covers: per-storage PITR toggle on the Backups tab, PITR configuration
> in the database creation wizard, restore-from-PITR modal, restore-to-new-cluster with PITR,
> and provider-side PITR config application.
>
> **Architecture reference:**
> [backups-restore-architecture.md](backups-restore-architecture.md) — sections "PITR is a
> per-storage property", "StorageRow visual design", "Flow 5: Restore from backup".
>
> **Implementation reference:**
> [backups-ui-implementation-plan.md](backups-ui-implementation-plan.md) — Phase 5 (PITR
> Management) and Phase 4 (Restore).
>
> **Provider repo:** `provider-percona-server-mongodb`

---

## Current State

| Area                                                             | Status                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| `BackupClass.spec.providerManaged.supportsPITR`                  | ✅ BE field exists, PSMDB sets `true`                   |
| `BackupClass.spec.providerManaged.limits.maxPITREnabledStorages` | ✅ PSMDB sets `1`                                       |
| `BackupClass.spec.providerManaged.pitrConfigSchema`              | ✅ PSMDB defines schema (oplogSpanMin, compressionType) |
| `BackupClass.spec.uiSchema.pitr` section                         | ✅ PSMDB `ui.yaml` fully defined                        |
| `InstanceBackupStoragePITR` CRD type                             | ✅ Exists with `enabled` + `config` fields              |
| `Restore.spec.dataSource.pitr` CRD type                          | ✅ `type: date\|latest` + `date`                        |
| PSMDB: reads `PITR.Enabled` and configures engine                | ✅ Implemented                                          |
| PSMDB: reads `PITR.Config` (oplogSpanMin, compressionType)       | ❌ **Missing**                                          |
| PSMDB: `SyncRestore()` with PITR date                            | ✅ Implemented                                          |
| Storages list on Backups tab                                     | ❌ Missing                                              |
| PITR toggle on Backups tab                                       | ❌ Missing                                              |
| `<PITRConfigModal />`                                            | ❌ Missing                                              |
| PITR section in wizard                                           | ❌ Missing — fields commented out                       |
| `buildBackupSpecFromWizard()` includes PITR                      | ❌ Missing                                              |
| v2 PITR data endpoint                                            | ❌ **Missing — needs BE work**                          |
| `useInstancePitr` hook                                           | ❌ Commented out (wrong URL, needs rewrite)             |
| `useCreateRestoreFromPointInTime` mutation                       | ❌ Commented out                                        |
| Restore modal PITR UI (radio, date picker, alerts)               | ❌ Entirely commented out                               |
| Restore to new cluster with PITR date                            | ❌ Missing (`pointInTimeDate` not passed)               |

---

## Phase A — Storages List with PITR Toggle (Backups Tab)

> **Goal:** Make per-storage PITR visible and configurable on the instance details Backups tab.
> Pattern: replicate `<ScheduledBackupsList />` accordion — a togglable section in the
> `<BackupsListTableHeader />`.
>
> **No blockers — can start immediately.**

### A.1 `<StoragesList />` component

Add a "Storage Locations (N)" toggle button next to "Active Schedules (N)" in
`<BackupsListTableHeader />`. When expanded, renders a Paper card per entry in
`instance.spec.backup.storages[]`.

Each card displays:

- Storage name (from `storageRef.name`)
- PITR status badge: "PITR: ON" / "PITR: OFF"
- Number of active schedules on this storage
- "Default" chip for the first storage (`main: true`)
- PITR toggle (`SwitchInput`)
- Gear icon (⚙) — visible only when PITR is enabled AND BackupClass has `pitrConfigSchema`
- Data source: `instance.spec.backup.storages[]`

**Files:**

- `NEW` `ui/apps/everest/src/pages/db-cluster-details/backups/backups-list/table-header/storages-list.tsx`
- `MODIFY` `ui/apps/everest/src/pages/db-cluster-details/backups/backups-list/table-header/backups-list-table-header.tsx` — add toggle button + conditional render

### A.2 PITR toggle logic

**Toggle OFF → ON:**

1. Read `BackupClass.spec.providerManaged.limits.maxPITREnabledStorages`
2. Count storages already with `pitr.enabled === true`
3. If `count >= maxPITREnabledStorages` → keep toggle OFF, show tooltip:
   `"Maximum {N} PITR-enabled storage(s) allowed for this provider"`
4. If no schedules exist on ANY storage → keep toggle OFF, show tooltip:
   `"PITR requires at least one active backup schedule"`
5. If `BackupClass.spec.providerManaged.pitrConfigSchema` is non-null:
   → open `<PITRConfigModal />` (A.3); on dismiss → toggle stays OFF
6. If no config schema → direct PATCH Instance: `storages[i].pitr = { enabled: true }`

**Toggle ON → OFF:**

1. Show `<ConfirmDialog />`: "Disabling PITR will stop continuous backup for this storage."
2. On confirm → PATCH Instance: `storages[i].pitr = { enabled: false }`

**Hide toggle entirely** when `BackupClass.spec.providerManaged.supportsPITR` is falsy.

**Auto-disable when last schedule is deleted:**

- Fix the `willDisablePITR = false` TODO in `scheduled-backups-list.tsx`:
  compute `willDisablePITR = storage has PITR enabled AND this is its last schedule`
- Show warning in schedule delete confirm dialog
- After schedule deletion, if `willDisablePITR` → PATCH Instance to set `pitr.enabled: false`

**Files:**

- `storages-list.tsx` — toggle, disable logic, PATCH calls
- `MODIFY` `scheduled-backups-list.tsx` — fix `willDisablePITR`, PATCH on last schedule delete
- Hook: `useBackupClasses` (already exists) to read `supportsPITR`, `limits`, `pitrConfigSchema`
- Hook: `useUpdateDbInstanceWithConflictRetry` (already used in schedules list)

### A.3 `<PITRConfigModal />`

MUI Dialog that renders the `pitr` UIGenerator section from the BackupClass.

```
┌─────────────────────────────────────────────────────────┐
│  Configure PITR — s3-prod                          [✕]  │
├─────────────────────────────────────────────────────────┤
│  <UIGenerator sectionKey="pitr" sections={uiSchema} />  │
│  (PSMDB: Oplog Span (min) + Oplog Compression)          │
│                                                         │
│                          [Cancel]  [Save]               │
└─────────────────────────────────────────────────────────┘
```

- Opened from: PITR toggle ON (when config schema exists) or ⚙ gear icon
- **Save:** PATCH Instance → `storages[i].pitr.config` with UIGenerator values
- **Cancel from toggle flow:** toggle reverts to OFF
- Uses same `UIGenerator` pattern as on-demand backup modal

**Files:**

- `NEW` `ui/apps/everest/src/pages/db-cluster-details/backups/pitr-config-modal/pitr-config-modal.tsx`
- `NEW` `ui/apps/everest/src/pages/db-cluster-details/backups/pitr-config-modal/pitr-config-modal.types.ts`

---

## Phase B — PITR in Database Creation Wizard

> **Goal:** Allow users to enable PITR when creating a new database instance.
> Reuses v1 patterns (pitrEnabled toggle + storage select) adapted to v2 per-storage model.
>
> **No blockers — can start in parallel with Phase A.**

### B.1 PITR section in `<BackupStep />`

Add below `<Schedules />`:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Point-in-time Recovery                                              │
│  PITR provides continuous backups of your database, enabling         │
│  you to restore it to a specific point in time.                      │
│                                                                      │
│  Enable PITR  [toggle]                                               │
│  Backup storage  [S3 compatible ▼]   ← shown for PSMDB only         │
└──────────────────────────────────────────────────────────────────────┘
```

**Provider-aware behavior (read from BackupClass):**

| BackupClass property             | UI behavior                                         |
| -------------------------------- | --------------------------------------------------- |
| `supportsPITR` absent or `false` | PITR section hidden                                 |
| `maxPITREnabledStorages: 1`      | Single toggle + single storage select               |
| `limits` absent (unlimited)      | Single toggle; storage select hidden (all storages) |
| `pitrConfigSchema` non-null      | Show ⚙ link to open `<PITRConfigModal />` inline    |

**Disabled condition:** Toggle disabled when `schedules.length === 0` with helper text:
`"Add a backup schedule above to enable point-in-time recovery"`

**Storage select:** Dropdown showing all namespace-level BackupStorages. Auto-selects the
first schedule's storage if only one schedule exists. Visible only for providers with
`maxPITREnabledStorages: 1`.

**Form fields added:**

- `backup.pitrEnabled: boolean`
- `backup.pitrStorageName: string` (storage name for PITR)

**Files:**

- `MODIFY` `ui/apps/everest/src/pages/database-form/database-form-body/steps/backup-step/backup-step.tsx`
- `NEW` `ui/apps/everest/src/pages/database-form/database-form-body/steps/backup-step/pitr-section.tsx`
- `MODIFY` `ui/apps/everest/src/pages/database-form/database-form-body/steps/backup-step/backup-step.messages.ts`

### B.2 Extend `buildBackupSpecFromWizard()` with PITR

When `pitrEnabled === true`:

- Find the storage entry matching `pitrStorageName` in the storages array
- Attach `pitr: { enabled: true }` to that entry
- If `pitrConfigValues` exist (from inline PITRConfigModal): attach `pitr.config`
- For providers without storage select (`maxPITREnabledStorages` absent): attach PITR to the
  first storage entry

```typescript
// Resulting Instance.spec.backup.storages entry:
{
  name: "s3-prod",
  storageRef: { name: "s3-prod" },
  pitr: { enabled: true, config: { oplogSpanMin: 10, compressionType: "snappy" } },
  schedules: [...]
}
```

**Files:**

- `MODIFY` `ui/apps/everest/src/pages/database-form/database-form-body/steps/backup-step/backup-step.utils.ts`

### B.3 Form schema validation

- `pitrEnabled: true` AND `schedules.length === 0` → add issue on `pitrEnabled`
- `pitrEnabled: true` AND `pitrStorageName` empty (when storage select is visible) → add issue

**Files:**

- `MODIFY` `ui/apps/everest/src/pages/database-form/database-form-schema.ts` — uncomment + adapt PITR fields

---

## Phase C — Restore from PITR Modal

> **Goal:** Enable the PITR restore option in the restore modal (date picker, provider alerts).
>
> **Blocker:** Phase C.1 requires a new backend endpoint.
> Phases C.3–C.5 can be developed with mock data in the meantime.

### C.1 New v2 PITR data endpoint ⚠️ Backend work needed

**Required:** `GET /clusters/{cluster}/namespaces/{namespace}/instances/{instance}/pitr`

Response:

```json
{
  "earliestDate": "2026-05-20T10:00:00Z",
  "latestDate": "2026-05-27T14:30:00Z",
  "latestBackupName": "backup-abc-123",
  "gaps": false
}
```

The old v1 endpoint `/namespaces/{namespace}/database-clusters/{name}/pitr` was removed and
has no handler in the current v2 server. This endpoint is required for the restore modal
date picker range and PITR availability check.

**See also:** [Backend questions](#backend-questions) section.

### C.2 `useInstancePitr` hook

New hook (rewrite of old `useDbClusterPitr`, not a simple uncomment — URL changes):

```typescript
export const useInstancePitr = (
  clusterName: string,
  namespace: string,
  instanceName: string,
  options?: PerconaQueryOptions<...>
) => useQuery({
  queryKey: [clusterName, namespace, instanceName, 'pitr'],
  queryFn: () => getPitrFn(clusterName, namespace, instanceName),
  select: (data) => /* map to DatabaseClusterPitr or undefined */,
});
```

**Files:**

- `MODIFY` `ui/apps/everest/src/api/backups.ts` — rewrite `getPitrFn` with v2 URL
- `MODIFY` `ui/apps/everest/src/hooks/api/backups/useBackups.ts` — implement `useInstancePitr`

### C.3 `useCreateRestoreFromPointInTime` mutation

Uncomment the existing commented-out mutation. Verify payload matches v2 Restore CR types:

```typescript
spec: {
  instanceName,
  dataSource: {
    backupName,
    pitr: { type: 'date', date: pointInTimeDate },
  },
}
```

**Files:**

- `MODIFY` `ui/apps/everest/src/hooks/api/restores/useDbClusterRestore.ts`

### C.4 Restore modal PITR UI

Uncomment and adapt the full PITR block in `modal-content.tsx`:

- **Radio options:** "From backup" (default) / "From a Point-in-time (PITR)"
- **PITR radio disabled when:**
  - `!pitrData` — no PITR data (data still loading or provider doesn't support PITR)
  - `pitrData?.gaps === true` — oplog/binlog gaps block PITR
  - `pitrData?.latestBackupName !== selectedBackupName` — PITR only available from latest backup
- **Alert: binlog gaps** (shown when `pitrData?.gaps === true`):
  > "Oops, your PITR data contains binlog gaps, which makes PITR currently unavailable for
  > this database. To ensure complete PITR points for future restores, start a full backup now."
- **Alert: PostgreSQL limitation** (shown when `dbType === DbType.Postresql && pitrData`):
  > "In PostgreSQL, point-in-time recovery (PITR) can get stuck in a Restoring state when
  > you attempt to recover the database after the last transaction. Refer to the documentation
  > for a workaround." + [See docs] button
- **Info alert** (shown when no gaps): PITR range description (earliest → latest date, storage name)
- **DateTimePickerInput:**
  - 24h format with seconds: `dd/MM/yyyy 'at' HH:mm:ss`
  - `minDate = pitrData.earliestDate`
  - `maxDate = pitrData.latestDate`
  - `disableFuture`
  - Disabled when `!pitrData`

**Files:**

- `MODIFY` `ui/apps/everest/src/modals/restore-db-modal/modal-content.tsx`
- `MODIFY` `ui/apps/everest/src/modals/restore-db-modal/restore-db-modal.tsx` — wire hooks + submit branch
- `MODIFY` `ui/apps/everest/src/modals/restore-db-modal/restore-db-modal.types.ts` — uncomment `pitrData` prop

### C.5 Restore modal validation schema

Uncomment `pitrBackup` field and its validation:

- `pitrBackup` required when `backupType === fromPitr`
- Date must satisfy: `earliestDate <= pitrBackup <= latestDate`
- `gaps === true` → add issue (blocks submission)

**Files:**

- `MODIFY` `ui/apps/everest/src/modals/restore-db-modal/restore-db-modal-schema.ts`

---

## Phase D — Restore to New Cluster with PITR

> **Goal:** Pass the selected PITR date through the "Restore to new database" flow.
>
> **Restore mode is already implemented** in `database-form.tsx` — this phase extends it.
> **Blocker:** Depends on C.3 (mutation hook). Backend clarification needed on
> `Instance.spec.dataSource.pitr` (see [Backend questions](#backend-questions)).

### D.1 Pass `pointInTimeDate` in router state

When user selects PITR type and clicks "Create new database":

```typescript
navigate("/databases/new", {
  state: {
    selectedDbCluster: instanceName,
    backupName: pitrData.latestBackupName, // PITR must use latestBackupName
    namespace,
    pointInTimeDate: pitrBackupDate.toISOString(), // NEW
  },
});
```

**Files:**

- `MODIFY` `ui/apps/everest/src/modals/restore-db-modal/restore-db-modal.tsx`

### D.2 Wizard reads PITR date and calls correct mutation

In `database-form.tsx` `onSubmit`, when `mode === FormMode.Restore`:

```typescript
const pointInTimeDate = location.state?.pointInTimeDate as string | undefined;

// After createInstance() succeeds:
if (pointInTimeDate) {
  createRestoreFromPointInTime({
    instanceName: newName,
    backupName,
    pointInTimeDate,
  });
} else {
  createRestore({ instanceName: newName, backupName });
}
```

**Files:**

- `MODIFY` `ui/apps/everest/src/pages/database-form/database-form.tsx`

### D.3 Backend dependency on `Instance.spec.dataSource.pitr`

PR #2305 adds `spec.dataSource.backupName` to the Instance CRD. For PITR restore-to-new-cluster,
two approaches are possible:

**Option A — Separate Restore CR (no extra BE work):**
Current approach: create Instance → on success, create Restore CR with `pitr` in `dataSource`.
Works today with the existing Restore CRD.

**Option B — Extend `Instance.spec.dataSource` with PITR:**
Add `pitr: { type: "date", date: "<timestamp>" }` to the Instance `DataSource` struct.
Cleaner but requires a BE CRD change. PR #2305 explicitly asks this as an open question.

**Recommended approach:** Use Option A for the first iteration (no blocking BE change).
Option B can be tracked as a follow-up improvement.

---

## Phase E — Provider Changes (`provider-percona-server-mongodb`)

> **Goal:** Apply PITR config values (oplogSpanMin, compressionType) from
> `Instance.spec.backup.storages[].pitr.config` to the PSMDB engine.
>
> **No blockers — independent branch in the provider repo.**

### E.1 Read and apply PITR config in `buildBackupSpec()`

**Location:** `internal/provider/backup.go`

**Current state:** Only sets `bs.PITR.Enabled = pitrEnabled`. The config values are never read.

**Required change:** After setting `Enabled`, find the PITR-enabled storage and unmarshal
`storage.PITR.Config` into `PerconaPITRConfig`, then apply fields to the PSMDB engine spec:

```go
// After: bs.PITR.Enabled = pitrEnabled
if pitrEnabled {
    for _, s := range backupCfg.Storages {
        if s.PITR != nil && s.PITR.Enabled && s.PITR.Config != nil {
            var pitrCfg PerconaPITRConfig
            if err := json.Unmarshal(s.PITR.Config.Raw, &pitrCfg); err == nil {
                if pitrCfg.OplogSpanMin != nil {
                    bs.PITR.OplogSpanMin = *pitrCfg.OplogSpanMin
                }
                if pitrCfg.CompressionType != "" {
                    bs.PITR.CompressionType = psmdbv1.CompressionType(pitrCfg.CompressionType)
                }
            }
        }
    }
}
```

**Files:**

- `MODIFY` `internal/provider/backup.go`

### E.2 Validate PITR config in `Validate()`

When PITR is enabled and config is provided, validate:

- `oplogSpanMin >= 1`
- `compressionType` in `{ none, snappy, zstd }`

Return a descriptive `BackupConfigError` if invalid.

**Files:**

- `MODIFY` `internal/provider/backup.go`

### E.3 BackupClass definition — already complete ✅

The following are already defined and require no changes:

- `supportsPITR: true`
- `limits.maxPITREnabledStorages: 1`
- `pitrConfigSchema` (references `PerconaPITRConfig`)
- `uiSchema.pitr` section (oplogSpanMin, compressionType fields)

---

## Provider-Specific Edge Cases

| Condition                | PSMDB (MongoDB)                              | PostgreSQL (future)                     |
| ------------------------ | -------------------------------------------- | --------------------------------------- |
| PITR enable              | Explicit toggle; max 1 storage               | Auto when any schedule exists           |
| PITR storage selection   | PITR-enabled storage becomes engine's "main" | Empty string (first schedule's storage) |
| `maxPITREnabledStorages` | `1`                                          | Not set (all storages can have PITR)    |
| PITR config fields       | `oplogSpanMin`, `compressionType`            | WAL-related (TBD)                       |
| Delete last schedule     | Must auto-disable PITR                       | Must auto-disable PITR                  |
| Restore date range       | `earliestDate` → `latestDate` date picker    | Same + "stuck in Restoring" alert       |
| Binlog/oplog gaps        | Block PITR restore entirely                  | Same                                    |
| PITR toggle in wizard    | Visible, user controls                       | Hidden / auto-enabled                   |
| PITR toggle disabled     | No schedules / limit reached                 | Not applicable                          |

---

## Backend Questions

> Send to BE team before starting Phase C.

---

**Q1: New v2 PITR data endpoint**

We need a v2 endpoint to expose PITR availability data for the restore modal.
The old v1 endpoint `/v1/namespaces/{namespace}/database-clusters/{name}/pitr` was removed
and has no handler in the current v2 server (confirmed: no file, no route registration).

**Suggested path:** `GET /clusters/{cluster}/namespaces/{namespace}/instances/{instance}/pitr`

**Response shape** (unchanged from v1, already defined as `DatabaseClusterPitr` schema in
`api/openapi/http-api.yaml`):

```json
{
  "earliestDate": "2026-05-20T10:00:00Z",
  "latestDate": "2026-05-27T14:30:00Z",
  "latestBackupName": "backup-abc-123",
  "gaps": false
}
```

**Context:** This is required for the restore modal to show a valid date picker range.
`gaps: true` blocks PITR entirely. `latestBackupName` determines which backup row
enables the PITR restore option.

**Alternative:** Could PITR metadata be exposed on `Instance.status` (e.g.,
`instance.status.backup.pitr`) populated continuously by the provider, instead of a
dedicated endpoint? This would avoid a new endpoint but requires provider status updates.

---

**Q2: `Instance.spec.dataSource.pitr` (related to PR #2305)**

PR #2305 adds `spec.dataSource.backupName` to the Instance CRD for restore-to-new-cluster.
PR #2305 explicitly asks: _"do we also want PITR for creating new instance from backup?"_

**Our answer:** Yes. For the first iteration we plan to use Option A below. Please confirm
whether Option B is in scope for PR #2305 or a follow-up.

**Option A (current plan — no extra BE work):**
Create the new Instance first → on success, create a Restore CR with
`spec.dataSource.pitr: { type: "date", date: "<timestamp>" }`.
Works today with the existing Restore CRD. No changes to Instance spec needed.

**Option B (cleaner, requires CRD change):**
Add `pitr` to `Instance.spec.dataSource`:

```yaml
spec:
  dataSource:
    backupName: backup-abc-123
    pitr:
      type: date
      date: "2026-05-27T14:30:00Z"
```

Provider-runtime creates the Restore CR internally. Removes one round-trip from the UI.

---

## File Inventory

### New files

| File                                                          | Phase | Purpose                          |
| ------------------------------------------------------------- | ----- | -------------------------------- |
| `ui/.../backups-list/table-header/storages-list.tsx`          | A.1   | Storages accordion component     |
| `ui/.../backups/pitr-config-modal/pitr-config-modal.tsx`      | A.3   | PITR config dialog (UIGenerator) |
| `ui/.../backups/pitr-config-modal/pitr-config-modal.types.ts` | A.3   | Modal props types                |
| `ui/.../backup-step/pitr-section.tsx`                         | B.1   | PITR section in wizard           |

### Modified files

| File                            | Phase   | Change                                               |
| ------------------------------- | ------- | ---------------------------------------------------- |
| `backups-list-table-header.tsx` | A.1     | Add "Storage Locations" toggle button                |
| `scheduled-backups-list.tsx`    | A.2     | Fix `willDisablePITR`, PATCH on last schedule delete |
| `backup-step.tsx`               | B.1     | Render `<PitrSection />` conditionally               |
| `backup-step.utils.ts`          | B.2     | Extend `buildBackupSpecFromWizard()` with PITR       |
| `database-form-schema.ts`       | B.3     | Uncomment + adapt PITR validation fields             |
| `api/backups.ts`                | C.2     | Rewrite `getPitrFn` with v2 URL                      |
| `useBackups.ts`                 | C.2     | Implement `useInstancePitr` hook                     |
| `useDbClusterRestore.ts`        | C.3     | Uncomment `useCreateRestoreFromPointInTime`          |
| `modal-content.tsx`             | C.4     | Uncomment full PITR block                            |
| `restore-db-modal.tsx`          | C.4     | Wire PITR hooks + submit branch                      |
| `restore-db-modal.types.ts`     | C.4     | Uncomment `pitrData` prop                            |
| `restore-db-modal-schema.ts`    | C.5     | Uncomment `pitrBackup` + date validation             |
| `database-form.tsx`             | D.2     | Read `pointInTimeDate`, call correct mutation        |
| `provider/.../backup.go`        | E.1–E.2 | Read PITR config, apply to engine, validate          |

---

## Dependency Graph

```
Phase A (Storages list + PITR toggle)  ─── can start now ──── Phase B (Wizard PITR)
                                                                        │
Phase E (Provider: PITR config apply)  ─── can start now (provider branch)

                    ┌─── Backend Q1: new PITR endpoint ───┐
Phase C (Restore from PITR)  ────────────────────────────── C.3/C.4/C.5 can be mocked
         │
         └──► Phase D (Restore to new cluster with PITR)
              depends on C.3 + Backend Q2 clarity
```

**Parallelizable from day 1:** Phases A, B, E  
**Unblocked for mock development:** C.3–C.5  
**Blocked on BE response:** C.1, C.2 (final URL), D (optional BE extension)

---

## Verification Criteria

| #   | Test                                 | Expected                                                               |
| --- | ------------------------------------ | ---------------------------------------------------------------------- |
| 1   | Toggle "Storage Locations" button    | Accordion expands showing storage cards                                |
| 2   | Storage card shows PITR badge        | Correctly reflects `storage.pitr.enabled`                              |
| 3   | Enable PITR on storage               | Instance patched with `storages[i].pitr.enabled: true`                 |
| 4   | Enable PITR with config schema       | `<PITRConfigModal>` opens; save patches `pitr.config`                  |
| 5   | Enable PITR when limit reached       | Toggle disabled, tooltip shows max count                               |
| 6   | Enable PITR when no schedules        | Toggle disabled with schedule requirement message                      |
| 7   | Delete last schedule on PITR storage | PITR auto-disabled on that storage                                     |
| 8   | Disable PITR                         | Confirmation dialog shown; Instance patched                            |
| 9   | Create DB with PITR in wizard        | Instance spec has `storages[i].pitr: { enabled: true, config: {...} }` |
| 10  | Wizard: no schedules → PITR toggle   | Toggle disabled with helper text                                       |
| 11  | Restore modal: PITR radio            | Radio enabled for latest backup only                                   |
| 12  | Restore modal: date picker           | Constrained to `earliestDate`–`latestDate`                             |
| 13  | Restore modal: gaps present          | Error alert shown, PITR radio disabled                                 |
| 14  | Restore modal: PostgreSQL            | "stuck in Restoring" alert shown                                       |
| 15  | PITR restore submit                  | Restore CR created with `dataSource.pitr.type: date`                   |
| 16  | Restore to new cluster: backup       | New instance created + Restore CR (no PITR)                            |
| 17  | Restore to new cluster: PITR         | New instance created + Restore CR with PITR date                       |
| 18  | PSMDB: oplogSpanMin applied          | Engine BackupSpec has correct oplog interval                           |
| 19  | PSMDB: compressionType applied       | Engine BackupSpec has correct compression                              |
| 20  | PSMDB: invalid config rejected       | Provider returns `BackupConfigError`                                   |
