# Lonelog para Obsidian - Diario para Solo TTRPG
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian)](https://obsidian.md/plugins)
[![version](https://img.shields.io/badge/version-1.6.1-blue.svg)](https://github.com/snifer/lonelog/releases)
[![license](https://img.shields.io/badge/license-0--BSD-green.svg)](LICENSE)
![GitHub Downloads](https://img.shields.io/github/downloads/Snifer/lonelog/total?logo)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/bastiondeldino)

Read this in English: [README.md](README.md)

![Lonelog Obsidian Plug-in Logo](./assets/lonelog-obsidian-logo.png)

**Lonelog para Obsidian** optimiza el registro de tus partidas de rol en solitario y en grupo integrando el estándar de [notación Lonelog](https://zeruhur.itch.io/lonelog) en tu bóveda y extendiéndolo con el add-on Partylog para sesiones grupales. Así puedes centrarte en la historia mientras mantienes las mecánicas organizadas, visibles y ágiles.

## Funcionalidades Principales

### 1. Sistema de Notación Inteligente
Inserta rápidamente los símbolos base de Lonelog mediante la paleta de comandos o atajos personalizados:

- `@` Acción
- `?` Pregunta de Oráculo
- `d:` Tirada de Dados
- `->` Resultado
- `=>` Consecuencia
- `[Tag:Name|Attributes]` Etiquetas de entidad para PNJs, lugares, PJs y más

### 2. Gestión de Campaña y Sesiones
- **Cabeceras automáticas** para crear estructura de campaña y sesión al instante
- **Marcadores de escena** con numeración automática y contexto opcional
- **Bloques de código** con soporte de renderizado `lonelog`

```lonelog
@ El personaje investiga
d: 1d6 -> 5
-> Sucede algo sospechoso.
```

### 3. Interfaz y Resaltado
- **Resaltado de sintaxis** en Live Preview y modo lectura
- **Personalización de colores** para cada token de Lonelog
- **Vistas dedicadas** para progreso, hilos, escenas, combate, mazmorra y recursos

### 4. Add-ons
- **Combate**: rondas, bloques de combate y seguimiento de enemigos
- **Dungeon crawling**: seguimiento de habitaciones y estado de mazmorra
- **Recursos**: gestión de inventario y riqueza
- **Partylog**: notación para sesiones grupales usando bloques ` ```partylog ` y un dashboard dedicado de Partylog
- **Cartas** y **notación avanzada de dados**

### 5. Otras Características
- **Autocompletado** basado en entidades mencionadas anteriormente
- **Internacionalización** en inglés y español
- **API pública v1** para interoperabilidad con otros plugins de Obsidian
- **Salidas JSON-friendly normalizadas** para integraciones externas más consistentes

## Instalación

### BRAT
1. Instala el plugin BRAT.
2. En la configuración de BRAT, pulsa `Add Beta Plugin`.
3. Ingresa `https://github.com/Snifer/lonelog`.
4. Activa Lonelog en `Configuración -> Plugins comunitarios`.

### Instalación Manual
1. Clona o copia los archivos de release en `.obsidian/plugins/lonelog/`.
2. Recarga Obsidian.
3. Activa **Lonelog** en `Configuración -> Plugins comunitarios`.

### Plugins Comunitarios
Próximamente.

## Uso
1. Abre cualquier nota.
2. Pulsa `Ctrl/Cmd + P` para abrir la paleta de comandos.
3. Escribe `Lonelog` para ver los comandos de inserción y gestión.
4. Asigna atajos en `Configuración -> Atajos de teclado` para registrar más rápido.

### Add-on de Partylog

Lonelog ahora incluye un add-on opcional de **Partylog** para notas de sesiones grupales.

Camino rápido:

1. Activa **Partylog add-on** en la configuración del plugin.
2. Escribe la notación Partylog dentro de bloques cercados `partylog`.
3. Abre **Partylog Dashboard** desde el selector de vistas o la paleta de comandos.

Ejemplo:

````markdown
```partylog
@(Kael) Sneak past the guard
d(Kael): Stealth d20+5=8 vs DC 14 -> Fail
=> Kicks a bottle. Guard turns!
! Guard draws his blade and advances
```
````

Pestañas actuales del dashboard de Partylog:

- Overview
- Scenes
- Threads
- Timeline
- Roster
- Recap

## Desarrollo

```bash
npm install
npm run dev
npm run build
```

## API Pública

Lonelog expone una API pública v1 para interoperabilidad con otros plugins de Obsidian a través de la instancia del plugin.

Ejemplo:

```ts
type LonelogApi = {
  apiVersion: "1";
  parse: {
    content(content: string): unknown;
    file(file: TFile): Promise<unknown>;
    isLonelogNote(target: TFile | string): Promise<boolean>;
  };
  tokenize: {
    line(line: string): unknown[];
    lines(lines: string[]): unknown[][];
  };
  settings: {
    get(): Record<string, unknown>;
  };
  views: {
    openDashboard(): Promise<void>;
  };
};

const lonelogPlugin = app.plugins.plugins["lonelog"] as { api?: LonelogApi } | undefined;

const api = lonelogPlugin?.api;
if (!api || api.apiVersion !== "1") return;

const parsed = api.parse.content("[N:Jonah|friendly]");
const tokens = api.tokenize.line("=> [N:Jonah|friendly]");

await api.views.openDashboard();
```

Alcance actual de la V1:

- `adapters.content`
- `adapters.file`
- `adapters.activeFile`
- `capabilities.get`
- `addons.getStatus`
- `dungeon.*`
- `resources.*`
- `combat.*`
- `progress.*`
- `partylog.*`
- `info.get`
- `info.getModules`
- `info.getStabilityPolicy`
- `errors.codes`
- `errors.isLonelogApiError`
- `events.on/off/offref`
- eventos de dominio para mutaciones de progress/resources
- write helpers para dungeon/partylog
- mutaciones profundas de inventory + tags estructurados de partylog
- write api de combat + mutaciones parciales de dungeon
- helpers puntuales finos
- salidas normalizadas json-friendly
- `parse.content`
- `parse.file`
- `parse.isLonelogNote`
- `parse.partylog.content`
- `parse.partylog.file`
- `parse.partylog.hasBlocks`
- `tokenize.line`
- `tokenize.lines`
- `settings.get`
- `views.open...`

Guía completa:

- [`lonelog-api.md`](./lonelog-api.md) — English
- [`lonelog-api-es.md`](./lonelog-api-es.md) — Castellano
- [`lonelog-api-changelog-es.md`](./lonelog-api-changelog-es.md) — changelog de API

## Licencia

Este plugin está bajo la licencia **0-BSD**. Consulta [LICENSE](LICENSE) para más detalles.

El sistema de notación Lonelog es © 2025-2026 Roberto Bisceglie y está licenciado bajo **CC BY-SA 4.0**.

## Soporte

Si este proyecto te aporta valor en tus mesas de juego, puedes apoyar al desarrollador mediante PayPal o Ko-fi.

[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/sniferl4bs)

## Créditos

- **Autor original del plugin**: Chris Hardiman
- **Desarrollo actual**: [Snifer](https://www.youtube.com/@BastiondelDinosaurio)
- **Sistema Lonelog**: [Roberto Bisceglie](https://zeruhur.itch.io/lonelog)
- **Filosofía de diseño**: Inspirado por el Valley Standard y las prácticas modernas de Solo TTRPG
