# Changelog de la API de Lonelog

Este archivo registra la API pública de Lonelog de forma independiente al changelog general del plugin.

## v1.6.1

### Agregado
- API pública inicial v1 expuesta mediante `plugin.api`
- APIs base de parsing, tokenización, settings y apertura de vistas
- `capabilities.get()` para descubrimiento machine-readable de features
- `info.get()`, `info.getModules()` y `info.getStabilityPolicy()`
- Contrato público de errores con códigos estables
- Sistema público de eventos para hooks generales y de mutación de dominio
- Módulos de API para Dungeon, Resources, Combat, Progress y Partylog
- Salidas JSON-friendly para Lonelog, Partylog, Dungeon, Resources, Combat y Progress
- Capa unificada de adapters:
  - `adapters.content(...)`
  - `adapters.file(...)`
  - `adapters.activeFile()`
- Helpers finos de lectura:
  - `progress.getLatestTrack(...)`
  - `dungeon.getLatestRoom(...)`
  - `partylog.getOpenThreads(...)`
  - `partylog.getActiveGoals(...)`
  - `partylog.getPartyResource(...)`
- Write API para Progress
- Write API profunda para Resources
- Write API parcial para Dungeon
- Write API parcial expandida para Combat con targeting por encounter y update/remove de combatants
- Write API parcial expandida para Partylog con targeting por bloque y upserts estructurados

### Notas de estabilidad
- `progress` y `resources` se consideran **completos para el alcance v1**
- `dungeon`, `combat` y `partylog` siguen siendo **parciales** y se espera que crezcan en la próxima iteración de la API
- `parse`, `json`, `tokenize`, `info`, `capabilities`, `settings`, `views` y `adapters` son superficies públicas de lectura/soporte, no de escritura

### Dirección de migración recomendada
- Prioriza `json.*` para consumo externo serializado
- Prioriza `adapters.*` para integraciones centradas en nota
- Preferí capability checks antes que suposiciones basadas en strings de versión
