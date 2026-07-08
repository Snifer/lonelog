# Lonelog Public API v1

Lonelog exposes a public API for other Obsidian plugins.

This document is now the **single English source of truth** for the API surface, integration flow, JSON outputs, adapters, events, errors, and write support policy.

Spanish version: [`lonelog-api-es.md`](./lonelog-api-es.md)

## Quick path

1. Get the plugin instance from `app.plugins.plugins["lonelog"]`.
2. Read `plugin.api`.
3. Check `api.apiVersion === "1"`.
4. Prefer `api.json.*` or `api.adapters.*` for external integrations.
5. Use `parse.*` only when you explicitly want richer native structures.

```ts
import type { App } from "obsidian";

function getLonelogApi(app: App) {
  const plugin = (app as App & {
    plugins?: { plugins?: Record<string, { api?: unknown }> };
  }).plugins?.plugins?.["lonelog"];

  if (!plugin || !plugin.api) return null;

  const api = plugin.api as { apiVersion: string };
  return api.apiVersion === "1" ? plugin.api : null;
}
```

## Integration rule

For third-party consumers, the official rule is:

- `parse.*` = rich/native Lonelog structures
- `json.*` = stable serializable snapshots
- `adapters.*` = fastest integration path for current-note and file-based consumers

## API areas

| Area | Purpose |
|------|---------|
| `adapters` | Unified consumer snapshots from content, file, or active file |
| `json` | JSON-friendly normalized outputs for every public gameplay domain |
| `addons` | Add-on enablement status |
| `dungeon` | Dungeon read/write helpers |
| `resources` | Inventory and wealth read/write helpers |
| `combat` | Combat read helpers plus targeted encounter/combatant write helpers |
| `progress` | Progress read/write helpers |
| `partylog` | Partylog read helpers plus block-targeted and lifecycle-aware write helpers |
| `info` | Plugin and module metadata |
| `capabilities` | Machine-readable feature discovery |
| `errors` | Public error contract |
| `events` | Reactive hooks for integrations |
| `parse` | Rich/native parsing |
| `tokenize` | Low-level token access |
| `settings` | Settings snapshot |
| `views` | Open Lonelog UI views |

## Adapters API

Use adapters when you want **one consistent object** without manually orchestrating multiple calls.

### `api.adapters.content(content)`

Returns a single snapshot with detection flags and normalized domain data.

```ts
const snapshot = api.adapters.content("[N:Jonah|friendly]\n[Track:Escape 3/6]");

console.log(snapshot.isLonelogNote);
console.log(snapshot.lonelog.npcs);
console.log(snapshot.progress.progress);
```

### `api.adapters.file(file)`

Reads a markdown file and returns the same snapshot shape.

### `api.adapters.activeFile()`

Reads the current Obsidian active file and returns the same snapshot shape, or `null` if there is no active file.

Returned snapshot shape:

```ts
{
  isLonelogNote: boolean;
  hasPartylogBlocks: boolean;
  lonelog: LonelogJson;
  partylog: PartylogJson;
  dungeon: DungeonJson;
  resources: ResourcesJson;
  combat: CombatJson;
  progress: ProgressJson;
}
```

## JSON API

These outputs are the official transport-safe contract for external consumers.

### `api.json.lonelog.content/file`
- NPCs, locations, threads, PCs, rooms, inventory as arrays
- wealth as `{ currency, amount }[]`
- combat as serializable encounter arrays

### `api.json.partylog.content/file`
- timeline, roster, resources, factions, goals, quests, loot, tables, dialogue, and related Partylog data

### `api.json.dungeon.content/file`

```ts
const dungeon = api.json.dungeon.content("[R:12|open|Hallway|exits north]");
console.log(dungeon.rooms);
```

### `api.json.resources.content/file`

```ts
const resources = api.json.resources.content("[Inv:Rope|1]\n[Wealth:Gold 12|Silver 4]");
console.log(resources.inventory, resources.wealth);
```

### `api.json.combat.content/file`

```ts
const combat = api.json.combat.content("[COMBAT]\n[PC:Kael|HP 5]\nRd2\n[/COMBAT]");
console.log(combat.encounters);
```

### `api.json.progress.content/file`

```ts
const progress = api.json.progress.content("[Track:Escape 3/6]");
console.log(progress.progress);
```

## Read helpers by module

### Dungeon
- `parseContent`
- `parseFile`
- `listRooms`
- `getRoom`
- `getLatestRoom`
- `isEnabled`
- `openView`

### Resources
- `parseContent`
- `parseFile`
- `listInventory`
- `getInventoryItem`
- `listWealth`
- `isEnabled`
- `openView`

### Combat
- `parseContent`
- `parseFile`
- `listEncounters`
- `getEncounter`
- `getLatestEncounter`
- `openView`

### Combat write methods
- `serialize.encounterBlock`
- `serialize.combatantTag`
- `serialize.roundLine`
- `serialize.closeBlock`
- `mutate.createEncounterInContent/File`
- `mutate.addCombatantInContent/File`
- `mutate.addCombatantToEncounterInContent/File`
- `mutate.updateCombatantInContent/File`
- `mutate.removeCombatantInContent/File`
- `mutate.advanceRoundInContent/File`
- `mutate.advanceRoundInEncounterInContent/File`
- `mutate.closeEncounterInContent/File`
- `mutate.closeEncounterByIdInContent/File`

### Progress
- `parseContent`
- `parseFile`
- `list`
- `get`
- `getLatestTrack`
- `openView`

### Partylog
- `parseContent`
- `parseFile`
- `hasBlocks`
- `getLatestBlockIndex`
- `getOpenThreads`
- `getActiveGoals`
- `getPartyResource`
- `isEnabled`
- `openView`

### Partylog write methods
- `serialize.entry`
- `serialize.tag`
- `mutate.appendEntryToContent/File`
- `mutate.appendEntryToBlockInContent/File`
- `mutate.appendTagToContent/File`
- `mutate.appendTagToBlockInContent/File`
- `mutate.upsertGoalInContent/File`
- `mutate.upsertQuestInContent/File`
- `mutate.upsertFactionInContent/File`
- `mutate.upsertThreadInContent/File`
- `mutate.upsertPartyInContent/File`

## Combat encounter targeting

`encounterId` comes from the parsed combat data itself:

```ts
const encounter = api.combat.getLatestEncounter(content);
if (!encounter) return;

await api.combat.mutate.updateCombatantInFile(file, encounter.id, {
  name: "Goblin",
  stats: ["HP 2"],
});
```

Use `getLatestEncounter(...)` when you intentionally want the most recent encounter.
Use `getEncounter(...)` when your integration already knows which encounter it is targeting.

## Partylog block targeting

`blockIndex` is **zero-based**:

- `0` = first ` ```partylog ` block
- `1` = second block
- `n` = nth block

`getLatestBlockIndex(content)` returns the latest available block index, or `null` if there are no Partylog blocks.

Use global append helpers when “latest block” is correct.
Use `...ToBlock...` helpers when your integration must target a specific Partylog block.

If the requested block index does not exist, append helpers fall back to creating/appending a Partylog block at the end of the content.

## Write API support policy

This is the formal v1 support policy for write operations.

| Module | Write API status | Current support | Expected improvement in next version |
|--------|------------------|-----------------|--------------------------------------|
| `progress` | **Complete for v1 scope** | serialize + upsert in content/file | broader bulk helpers if demand appears |
| `resources` | **Complete for v1 scope** | inventory append/set/delta/properties/move + wealth upsert | possible batch mutations and stronger slot/container helpers |
| `dungeon` | **Partial** | room upsert + add/remove status + add/remove exit | more targeted partial mutations, especially description/metadata helpers |
| `combat` | **Partial** | create encounter + add combatant + add combatant to specific encounter + update/remove combatant + advance round globally or by encounter + close globally or by encounter | encounter-targeted helpers are now present; next step is richer multi-combatant and encounter-state mutations |
| `partylog` | **Partial** | append entry/tag globally or by block + upsert goals, quests, factions, party resources, and threads | next step is deeper lifecycle mutations, selective removal helpers, and more explicit block/section targeting semantics |
| `core parse/json/tokenize` | **Read-only** | no write contract in v1 | no committed write surface yet |

### Why this policy matters

External modules need to know whether a surface is:

- production-safe now
- intentionally narrow
- expected to expand later without pretending it is already complete

That is EXACTLY why this table exists.

## Mutation result contract

All public mutation helpers return:

```ts
{
  content: string;
  value: string;
  updated: boolean;
  inserted: boolean;
}
```

- `content` = full resulting markdown
- `value` = the main inserted/replaced tag or line
- `updated` = an existing target was changed
- `inserted` = a new target was appended/created

In practice:

- `updated: true` usually means “replace in place”
- `inserted: true` usually means “append or create”

Some helpers may return `updated: true` and `inserted: false` even when targeting is block-aware rather than line-aware.

## Write support labels

- **Complete for v1 scope** = the write surface is intentionally small, but considered officially usable for its current contract.
- **Partial** = officially supported, but still expected to grow with more intent-level helpers in the next version.
- **Read-only** = no public write contract exists yet.

## Write API examples

### Progress

```ts
await api.progress.mutate.upsertInFile(file, {
  kind: "track",
  name: "Ritual",
  current: 3,
  max: 6,
});
```

### Resources

```ts
api.resources.mutate.moveInventoryItemInContent("", {
  name: "Torch",
  fromSlot: "Backpack 1",
  toSlot: "Backpack 2",
  quantity: 3,
});
```

### Dungeon

```ts
api.dungeon.mutate.addStatusInContent(
  "[R:12|open|Hallway|exits north]",
  "12",
  "lit",
);
```

### Combat

```ts
const encounter = api.combat.getLatestEncounter("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]");

api.combat.mutate.addCombatantToEncounterInContent("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]", encounter!.id, {
  type: "foe",
  name: "Goblin",
  stats: ["HP 4"],
});

api.combat.mutate.updateCombatantInContent("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]", encounter!.id, {
  name: "Goblin",
  stats: ["HP 2"],
});
```

### Partylog

```ts
api.partylog.mutate.upsertGoalInContent("```partylog\n[Goal:Escort the Prince|Active]\n```", {
  type: "goal",
  name: "Escort the Prince",
  state: "Completed",
});

api.partylog.mutate.upsertThreadInContent("```partylog\n[Thread:Escort Prince|Open]\n```", {
  type: "thread",
  name: "Escort Prince",
  state: "Closed",
});
```

## Capabilities API

Use `api.capabilities.get()` to detect support instead of guessing from plugin version strings.

```ts
const capabilities = api.capabilities.get();

if (capabilities.adapters.activeFile) {
  const snapshot = await api.adapters.activeFile();
  console.log(snapshot);
}
```

## Module metadata and stability

### `api.info.get()`
Returns plugin metadata and API version.

### `api.info.getModules()`
Returns stable module-level metadata.

### `api.info.getStabilityPolicy()`
Returns API-wide stability guarantees.

Use these methods when your plugin needs a formal compatibility check.

## Events

General events:
- `settings-changed`
- `note-changed`
- `view-opened`

Domain events:
- `progress-mutated`
- `resources-inventory-appended`
- `resources-inventory-mutated`
- `resources-wealth-upserted`
- `dungeon-room-upserted`
- `partylog-entry-appended`
- `partylog-tag-appended`
- `partylog-tag-mutated`
- `combat-encounter-created`
- `combat-combatant-added`
- `combat-combatant-updated`
- `combat-combatant-removed`
- `combat-round-advanced`
- `combat-encounter-closed`

## Event payloads

### General events

```ts
settings-changed => { settings }
note-changed => { file, isLonelogNote, hasPartylogBlocks }
view-opened => { viewType }
```

### Mutation events

```ts
progress-mutated => { target, file?, tag, updated, inserted, input }
resources-inventory-appended => { target, file?, tag, input }
resources-inventory-mutated => { target, file?, tag, action }
resources-wealth-upserted => { target, file?, tag, updated, inserted, input }
dungeon-room-upserted => { target, file?, tag, updated, inserted, input }
partylog-entry-appended => { target, file?, entry, input }
partylog-tag-appended => { target, file?, tag, input }
partylog-tag-mutated => { target, file?, tag, action }
combat-encounter-created => { target, file?, block }
combat-combatant-added => { target, file?, tag }
combat-combatant-updated => { target, file?, tag }
combat-combatant-removed => { target, file?, name }
combat-round-advanced => { target, file?, roundLine }
combat-encounter-closed => { target, file?, block }
```

## Errors

Public error codes:
- `FILE_READ_FAILED`
- `FILE_WRITE_FAILED`
- `INVALID_FILE_TYPE`
- `INVALID_INPUT`

```ts
try {
  await api.parse.file(file);
} catch (error) {
  if (api.errors.isLonelogApiError(error)) {
    console.warn(error.code);
  }
}
```

## Recommended integration order

1. Check `api.apiVersion`
2. Read `api.capabilities.get()`
3. Prefer `api.adapters.activeFile()` for current-note integrations
4. Prefer `api.json.*` for transport-safe snapshots
5. Use domain `mutate.*` only where the write policy says the surface is supported
6. Subscribe to events instead of polling when possible

## Real-world integration examples

### Example 1: Status bar or dashboard plugin

Use `adapters.activeFile()` when your plugin wants one compact read of the current note.

```ts
const snapshot = await api.adapters.activeFile();
if (!snapshot?.isLonelogNote) return;

const activeTrack = snapshot.progress.progress.find((item) => item.type === "track");
console.log(activeTrack?.name, activeTrack?.current);
```

### Example 2: Combat overlay plugin

Use combat targeting helpers when your plugin needs to update the current encounter without reparsing everything manually.

```ts
const fileSnapshot = await api.adapters.activeFile();
if (!fileSnapshot) return;

const encounter = api.combat.getLatestEncounter(fileSnapshot.file ? await app.vault.read(fileSnapshot.file) : "");
if (!encounter) return;

await api.combat.mutate.updateCombatantInFile(fileSnapshot.file, encounter.id, {
  name: "Goblin",
  stats: ["HP 1"],
});
```

### Example 3: Partylog session assistant

Use block targeting when your plugin needs to append into a specific Partylog block instead of the latest one.

```ts
const blockIndex = api.partylog.getLatestBlockIndex(content);
if (blockIndex === null) return;

api.partylog.mutate.upsertGoalInContent(content, {
  type: "goal",
  name: "Escort the Prince",
  state: "Completed",
}, blockIndex);
```

### Example 4: Export or sync plugin

Use `json.*` when your plugin needs transport-safe snapshots for APIs, files, or remote sync.

```ts
const payload = api.json.partylog.content(content);
await fetch("https://example.invalid/lonelog-sync", {
  method: "POST",
  body: JSON.stringify(payload),
});
```

## Integration snippets by consumer plugin type

### Read-only viewer plugin

Best fit:
- `api.adapters.activeFile()`
- `api.json.*`
- `api.events.on("note-changed", ...)`

### Progress or campaign tracker plugin

Best fit:
- `api.progress.getLatestTrack(...)`
- `api.json.progress.*`
- `api.progress.mutate.upsert...`

### Combat helper plugin

Best fit:
- `api.combat.getLatestEncounter(...)`
- `api.combat.mutate.addCombatantToEncounter...`
- `api.combat.mutate.updateCombatant...`
- `api.events.on("combat-round-advanced", ...)`

### Party or session manager plugin

Best fit:
- `api.partylog.getLatestBlockIndex(...)`
- `api.partylog.mutate.upsertGoal...`
- `api.partylog.mutate.upsertThread...`
- `api.partylog.mutate.upsertParty...`

### Export, sync, or automation plugin

Best fit:
- `api.json.*`
- `api.adapters.file(...)`
- `api.info.getModules()`
- `api.capabilities.get()`

## Support expectation for module authors

If you build against the public API:

- rely on `json.*` and `adapters.*` for stable external data exchange
- treat `parse.*` as richer but more implementation-shaped
- respect the write support table above
- prefer capability checks over assumptions

## Related files

- [`lonelog-api-es.md`](./lonelog-api-es.md) — Spanish version
- [`lonelog-api-changelog.md`](./lonelog-api-changelog.md) — API-specific changelog
