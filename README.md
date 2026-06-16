# Lonelog for Obsidian - Solo TTRPG Journaling
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian)](https://obsidian.md/plugins)
[![version](https://img.shields.io/badge/version-1.5.7-blue.svg)](https://github.com/snifer/lonelog/releases)
[![license](https://img.shields.io/badge/license-0--BSD-green.svg)](LICENSE)
![GitHub Downloads](https://img.shields.io/github/downloads/Snifer/lonelog/total?logo)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/bastiondeldino)

Lee esto en Castellano: [README-es.md](README-es.md)

![Lonelog Obsidian Plug-in Logo](./assets/lonelog-obsidian-logo.png)

**Lonelog for Obsidian** streamlines your solo TTRPG journaling by bringing the [Lonelog notation](https://zeruhur.itch.io/lonelog) standard directly into your vault. Focus on the story while keeping mechanics organized, visual, and fast.

## Main Features

### 1. Smart Notation System
Quickly insert Lonelog core symbols using the Command Palette or custom hotkeys:

- `@` Action
- `?` Oracle Question
- `d:` Dice Roll
- `->` Result
- `=>` Consequence
- `[Tag:Name|Attributes]` Entity tags for NPCs, locations, PCs, and more

### 2. Campaign and Session Management
- **Automatic headers** to create campaign and session structure instantly
- **Scene markers** with automatic scene numbering and optional context prompts
- **Code blocks** with `lonelog` rendering support

```lonelog
@ The character investigates
d: 1d6 -> 5
-> Something suspicious happens.
```

### 3. Interface and Highlighting
- **Syntax highlighting** in Live Preview and Reading Mode
- **Color customization** for every Lonelog token
- **Dedicated views** for progress, threads, scenes, combat, dungeon, and resources

### 4. Add-ons
- **Combat**: rounds, combat blocks, foe tracking
- **Dungeon crawling**: room state tracking and dungeon status
- **Resource tracking**: inventory and wealth management
- **Card drawing** and **advanced dice notation**

### 5. Other Features
- **Autocomplete** based on previously mentioned entities
- **Internationalization** in English and Spanish


## Installation

### BRAT
1. Install the BRAT plugin.
2. In BRAT settings, click `Add Beta Plugin`.
3. Enter `https://github.com/Snifer/lonelog`.
4. Enable Lonelog in `Settings -> Community Plugins`.

### Manual Installation
1. Clone or copy the release files into `.obsidian/plugins/lonelog/`.
2. Reload Obsidian.
3. Enable **Lonelog** in `Settings -> Community Plugins`.

### Community Plugins


## Usage
1. Open any note.
2. Press `Ctrl/Cmd + P` to open the command palette.
3. Type `Lonelog` to see insertion and management commands.
4. Assign hotkeys in `Settings -> Hotkeys` for faster logging.

## Development

```bash
npm install
npm run dev
npm run build
```

## Public API 

Current work in Public API v1 for interoperability with other Obsidian plugins available in branch

Lonelog exposes an initial public API for interoperability with other Obsidian plugins through the plugin instance.

Example:

```ts
const lonelogPlugin = app.plugins.plugins["lonelog"] as
  | { api?: import("./src/api").LonelogApi }
  | undefined;

const api = lonelogPlugin?.api;
if (!api || api.apiVersion !== "1") return;

const parsed = api.parse.content("[N:Jonah|friendly]");
const tokens = api.tokenize.line("=> [N:Jonah|friendly]");

await api.views.openDashboard();
```

Current V1 scope:

- `parse.content`
- `parse.file`
- `parse.isLonelogNote`
- `tokenize.line`
- `tokenize.lines`
- `settings.get`
- `views.open...`


## License

This plugin is licensed under the **0-BSD License**. See [LICENSE](LICENSE) for details.

The Lonelog notation system is © 2025-2026 Roberto Bisceglie, licensed under **CC BY-SA 4.0**.

## Support

If this project adds value to your gaming table, you can support the developer with a donation via PayPal or Ko-fi.

[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/sniferl4bs)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/bastiondeldino)


## Credits


- **Developed by**: [Snifer](https://www.youtube.com/@BastiondelDinosaurio)
- **Lonelog System**: [Roberto Bisceglie](https://zeruhur.itch.io/lonelog)
