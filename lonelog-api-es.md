# API Pública de Lonelog v1

Lonelog expone una API pública para que otros plugins de Obsidian puedan integrarse.

Este documento es ahora la **única fuente oficial en castellano** para la superficie de API, flujo de integración, salidas JSON, adapters, eventos, errores y política formal de soporte de escritura.

English version: [`lonelog-api.md`](./lonelog-api.md)

## Camino rápido

1. Obtén la instancia del plugin desde `app.plugins.plugins["lonelog"]`.
2. Lee `plugin.api`.
3. Verifica `api.apiVersion === "1"`.
4. Para integraciones externas, prioriza `api.json.*` o `api.adapters.*`.
5. Usa `parse.*` solo cuando realmente necesites estructuras nativas más ricas.

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

## Regla de integración

Para consumidores externos, la regla oficial es:

- `parse.*` = estructuras Lonelog ricas/nativas
- `json.*` = snapshots estables y serializables
- `adapters.*` = camino más rápido para integraciones sobre nota actual o archivo

## Áreas de API

| Área | Propósito |
|------|-----------|
| `adapters` | Snapshots unificados desde contenido, archivo o archivo activo |
| `json` | Salidas normalizadas JSON-friendly para todos los dominios públicos |
| `addons` | Estado de habilitación de add-ons |
| `dungeon` | Helpers de lectura/escritura para dungeon |
| `resources` | Helpers de lectura/escritura para inventario y riqueza |
| `combat` | Lectura de combate y helpers oficiales de escritura por encounter/combatant |
| `progress` | Helpers de lectura/escritura de progreso |
| `partylog` | Lectura de Partylog y helpers de escritura estructurada con targeting por bloque |
| `info` | Metadatos del plugin y de módulos |
| `capabilities` | Descubrimiento machine-readable de capacidades |
| `errors` | Contrato público de errores |
| `events` | Hooks reactivos para integraciones |
| `parse` | Parsing rico/nativo |
| `tokenize` | Acceso de bajo nivel a tokens |
| `settings` | Snapshot de configuración |
| `views` | Apertura de vistas de Lonelog |

## API de Adapters

Usa adapters cuando quieras **un único objeto consistente** sin tener que encadenar varias llamadas manualmente.

### `api.adapters.content(content)`

Devuelve un snapshot único con flags de detección y datos normalizados por dominio.

```ts
const snapshot = api.adapters.content("[N:Jonah|friendly]\n[Track:Escape 3/6]");

console.log(snapshot.isLonelogNote);
console.log(snapshot.lonelog.npcs);
console.log(snapshot.progress.progress);
```

### `api.adapters.file(file)`

Lee un archivo markdown y devuelve el mismo shape de snapshot.

### `api.adapters.activeFile()`

Lee el archivo activo actual de Obsidian y devuelve el mismo shape, o `null` si no hay archivo activo.

Shape devuelto:

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

## API JSON

Estas salidas son el contrato oficial, serializable y seguro para consumidores externos.

### `api.json.lonelog.content/file`
- NPCs, locations, threads, PCs, rooms e inventory como arrays
- wealth como `{ currency, amount }[]`
- combat como arrays serializables de encuentros

### `api.json.partylog.content/file`
- timeline, roster, resources, factions, goals, quests, loot, tables, dialogue y el resto de datos relevantes de Partylog

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

## Helpers de lectura por módulo

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

### Métodos de escritura de Combat
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

### Métodos de escritura de Partylog
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

## Targeting de encounters en Combat

`encounterId` sale del propio parseo de combate:

```ts
const encounter = api.combat.getLatestEncounter(content);
if (!encounter) return;

await api.combat.mutate.updateCombatantInFile(file, encounter.id, {
  name: "Goblin",
  stats: ["HP 2"],
});
```

Usa `getLatestEncounter(...)` cuando realmente querés apuntar al encounter más reciente.
Usa `getEncounter(...)` cuando tu integración ya sabe qué encounter debe tocar.

## Targeting de bloques en Partylog

`blockIndex` es **base 0**:

- `0` = primer bloque ` ```partylog `
- `1` = segundo bloque
- `n` = bloque n

`getLatestBlockIndex(content)` devuelve el índice del bloque más reciente, o `null` si no existe ningún bloque Partylog.

Usa los helpers globales cuando “último bloque” es la semántica correcta.
Usa los helpers `...ToBlock...` cuando tu integración necesita apuntar a un bloque específico.

Si el índice pedido no existe, los helpers de append hacen fallback a crear/anexar un bloque Partylog al final del contenido.

## Política formal de soporte de Write API

Esta es la política oficial de soporte v1 para operaciones de escritura.

| Módulo | Estado de Write API | Soporte actual | Mejora esperada en próxima versión |
|--------|---------------------|----------------|------------------------------------|
| `progress` | **Completa para el alcance v1** | serialize + upsert en content/file | helpers de bulk si aparece demanda real |
| `resources` | **Completa para el alcance v1** | inventory append/set/delta/properties/move + wealth upsert | posibles mutaciones por lote y helpers más fuertes para slots/contenedores |
| `dungeon` | **Parcial** | room upsert + add/remove status + add/remove exit | mutaciones parciales más específicas, sobre todo description/metadata |
| `combat` | **Parcial** | create encounter + add combatant + add combatant a encounter específico + update/remove de combatant + advance round global o por encounter + close global o por encounter | ya existe targeting por encounter; lo siguiente es profundizar mutaciones multi-combatant y estado del encounter |
| `partylog` | **Parcial** | append entry/tag global o por bloque + upsert de goals, quests, factions, recursos de party y threads | lo siguiente es agregar mutaciones de ciclo de vida más profundas, helpers de removal y targeting más explícito por bloque/sección |
| `core parse/json/tokenize` | **Solo lectura** | sin contrato de escritura en v1 | sin superficie de escritura comprometida todavía |

### Por qué importa esta política

Los módulos externos necesitan saber si una superficie:

- ya es segura para producción
- es intencionalmente acotada
- se espera que crezca después sin fingir que hoy ya está completa

Por eso EXISTE esta tabla.

## Contrato de retorno de mutaciones

Todos los helpers públicos de mutación devuelven:

```ts
{
  content: string;
  value: string;
  updated: boolean;
  inserted: boolean;
}
```

- `content` = markdown completo resultante
- `value` = tag o línea principal insertada/reemplazada
- `updated` = se modificó un objetivo existente
- `inserted` = se anexó o creó un objetivo nuevo

En la práctica:

- `updated: true` suele significar “reemplazo en sitio”
- `inserted: true` suele significar “append o creación”

Algunos helpers pueden devolver `updated: true` y `inserted: false` aunque el targeting sea por bloque y no por línea.

## Significado de las etiquetas de soporte

- **Completa para el alcance v1** = la superficie de escritura es chica a propósito, pero ya se considera oficialmente usable para su contrato actual.
- **Parcial** = está soportada oficialmente, pero todavía se espera que crezca con más helpers orientados a intención en la próxima versión.
- **Solo lectura** = todavía no existe contrato público de escritura.

## Ejemplos de Write API

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

## API de Capabilities

Usa `api.capabilities.get()` para detectar soporte en vez de adivinar por número de versión.

```ts
const capabilities = api.capabilities.get();

if (capabilities.adapters.activeFile) {
  const snapshot = await api.adapters.activeFile();
  console.log(snapshot);
}
```

## Metadatos de módulos y estabilidad

### `api.info.get()`
Devuelve metadatos del plugin y la versión de API.

### `api.info.getModules()`
Devuelve metadatos estables a nivel de módulo.

### `api.info.getStabilityPolicy()`
Devuelve las garantías globales de estabilidad de la API.

Usa estos métodos cuando tu plugin necesite una verificación formal de compatibilidad.

## Eventos

Eventos generales:
- `settings-changed`
- `note-changed`
- `view-opened`

Eventos de dominio:
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

## Payloads de eventos

### Eventos generales

```ts
settings-changed => { settings }
note-changed => { file, isLonelogNote, hasPartylogBlocks }
view-opened => { viewType }
```

### Eventos de mutación

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

## Errores

Códigos públicos:
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

## Orden recomendado de integración

1. Verifica `api.apiVersion`
2. Lee `api.capabilities.get()`
3. Para integraciones sobre nota actual, prioriza `api.adapters.activeFile()`
4. Para snapshots serializables, prioriza `api.json.*`
5. Usa `mutate.*` solo donde la política de write indique que la superficie está soportada
6. Cuando se pueda, suscríbete a eventos en lugar de hacer polling

## Ejemplos por caso real

### Ejemplo 1: Plugin de status bar o dashboard

Usa `adapters.activeFile()` cuando tu plugin quiera una lectura compacta de la nota actual.

```ts
const snapshot = await api.adapters.activeFile();
if (!snapshot?.isLonelogNote) return;

const activeTrack = snapshot.progress.progress.find((item) => item.type === "track");
console.log(activeTrack?.name, activeTrack?.current);
```

### Ejemplo 2: Plugin overlay de combate

Usa targeting de Combat cuando tu plugin necesite actualizar el encounter actual sin reparsear todo manualmente.

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

### Ejemplo 3: Asistente de sesión para Partylog

Usa targeting por bloque cuando tu plugin necesite escribir en un bloque Partylog específico y no solo en el último.

```ts
const blockIndex = api.partylog.getLatestBlockIndex(content);
if (blockIndex === null) return;

api.partylog.mutate.upsertGoalInContent(content, {
  type: "goal",
  name: "Escort the Prince",
  state: "Completed",
}, blockIndex);
```

### Ejemplo 4: Plugin de export o sync

Usa `json.*` cuando tu plugin necesite snapshots seguros para transporte hacia APIs, archivos o sync remoto.

```ts
const payload = api.json.partylog.content(content);
await fetch("https://example.invalid/lonelog-sync", {
  method: "POST",
  body: JSON.stringify(payload),
});
```

## Snippets por tipo de plugin consumidor

### Plugin visor de solo lectura

Mejor encaje:
- `api.adapters.activeFile()`
- `api.json.*`
- `api.events.on("note-changed", ...)`

### Plugin de progreso o campaign tracker

Mejor encaje:
- `api.progress.getLatestTrack(...)`
- `api.json.progress.*`
- `api.progress.mutate.upsert...`

### Plugin helper de combate

Mejor encaje:
- `api.combat.getLatestEncounter(...)`
- `api.combat.mutate.addCombatantToEncounter...`
- `api.combat.mutate.updateCombatant...`
- `api.events.on("combat-round-advanced", ...)`

### Plugin gestor de party o sesión

Mejor encaje:
- `api.partylog.getLatestBlockIndex(...)`
- `api.partylog.mutate.upsertGoal...`
- `api.partylog.mutate.upsertThread...`
- `api.partylog.mutate.upsertParty...`

### Plugin de export, sync o automatización

Mejor encaje:
- `api.json.*`
- `api.adapters.file(...)`
- `api.info.getModules()`
- `api.capabilities.get()`

## Expectativa de soporte para autores de módulos

Si construís sobre la API pública:

- apoyate en `json.*` y `adapters.*` para intercambio estable de datos
- tratá `parse.*` como una superficie más rica, pero más parecida a la implementación
- respetá la tabla formal de soporte de escritura
- preferí capability checks antes que supuestos

## Archivos relacionados

- [`lonelog-api.md`](./lonelog-api.md) — English version
- [`lonelog-api-changelog-es.md`](./lonelog-api-changelog-es.md) — changelog específico de API
