import { App, PluginSettingTab, Setting } from "obsidian";
import LonelogPlugin from "./main";
import { t, setLocale } from "./i18n/i18n";

export interface LonelogSettings {
	// Phase 1 settings
	insertSpaceAfterSymbol: boolean;
	smartCursorPositioning: boolean;

	// Phase 2 settings
	autoIncrementScenes: boolean;
	promptForSceneContext: boolean;
	autoWrapInCodeBlock: boolean;

	// Phase 3: Frontmatter Automation
	defaultRuleset: string;
	defaultGenre: string;
	defaultPlayer: string;
	defaultThemes: string;
	defaultTone: string;
	autoUpdateLastUpdate: boolean;

	// Template customization
	actionSequenceTemplate: string;
	oracleSequenceTemplate: string;

	// Highlighting settings
	enableEditorHighlighting: boolean;
	enableReadingHighlighting: boolean;
	enableDiceRoller: boolean;

	// Dice roller output settings
	diceDetailMode: boolean;   // Show individual dice values instead of sum
	diceHighLabel: string;     // Label for the highest die
	showDiceHigh: boolean;     // Whether to show the high die annotation
	diceLowLabel: string;      // Label for the lowest die
	showDiceLow: boolean;      // Whether to show the low die annotation

	// Highlighting colors
	colorAction: string;      // @ lines — blue
	colorQuestion: string;    // ? lines — purple
	colorDice: string;        // d: lines — green
	colorConsequence: string; // => lines — red
	colorResult: string;      // -> token — yellow
	colorTag: string;         // [N:...] tokens — orange
	colorMeta: string;        // (note: ...) — gray
	colorDialogue: string;    // Speaker: "..." — cyan
	colorNarrative: string;   // \--- narrative --- — pink
	colorTable: string;       // tbl: — lime
	colorGenerator: string;   // gen: — teal
	locale: string;           // Interface language
}

export const DEFAULT_SETTINGS: LonelogSettings = {
	insertSpaceAfterSymbol: true,
	smartCursorPositioning: true,
	autoIncrementScenes: true,
	promptForSceneContext: true,
	autoWrapInCodeBlock: false,

	// Phase 3 Defaults
	defaultRuleset: "Loner + Mythic Oracle",
	defaultGenre: "Fantasy",
	defaultPlayer: "Player 1",
	defaultThemes: "Exploration, Adventure",
	defaultTone: "Heroic",
	autoUpdateLastUpdate: true,

	actionSequenceTemplate: "@ [action]\nd: [roll] -> [outcome]\n=> [consequence]",
	oracleSequenceTemplate: "? [question]\n-> [answer]\n=> [consequence]",

	// Highlighting toggles
	enableEditorHighlighting: true,
	enableReadingHighlighting: true,
	enableDiceRoller: true,

	// Dice output defaults
	diceDetailMode: false,
	diceHighLabel: "High",
	showDiceHigh: true,
	diceLowLabel: "Low",
	showDiceLow: true,

	// Match the values currently used in highlighter.css
	colorAction: "#3b82f6",  // blue
	colorQuestion: "#8b5cf6",  // purple
	colorDice: "#22c55e",  // green
	colorConsequence: "#ef4444",  // red
	colorResult: "#ca8a04",  // yellow
	colorTag: "#c2410c",  // orange
	colorMeta: "#71717a",  // gray
	colorDialogue: "#0891b2",  // cyan
	colorNarrative: "#db2777",  // pink
	colorTable: "#84cc16",  // lime
	colorGenerator: "#0d9488",  // teal
	locale: "en",
};

/** Sets Lonelog CSS custom properties on document.body */
export function applyHighlightColors(settings: LonelogSettings): void {
	document.body.style.setProperty("--ll-action-color", settings.colorAction);
	document.body.style.setProperty("--ll-question-color", settings.colorQuestion);
	document.body.style.setProperty("--ll-dice-color", settings.colorDice);
	document.body.style.setProperty("--ll-consequence-color", settings.colorConsequence);
	document.body.style.setProperty("--ll-result-color", settings.colorResult);
	document.body.style.setProperty("--ll-tag-color", settings.colorTag);
	document.body.style.setProperty("--ll-meta-color", settings.colorMeta);
	document.body.style.setProperty("--ll-dialogue-color", settings.colorDialogue);
	document.body.style.setProperty("--ll-narrative-color", settings.colorNarrative);
	document.body.style.setProperty("--ll-table-color", settings.colorTable);
	document.body.style.setProperty("--ll-generator-color", settings.colorGenerator);
}

/** Removes the injected CSS custom properties (call from onunload). */
export function removeHighlightColors(): void {
	document.body.style.removeProperty("--ll-action-color");
	document.body.style.removeProperty("--ll-question-color");
	document.body.style.removeProperty("--ll-dice-color");
	document.body.style.removeProperty("--ll-consequence-color");
	document.body.style.removeProperty("--ll-result-color");
	document.body.style.removeProperty("--ll-tag-color");
	document.body.style.removeProperty("--ll-meta-color");
	document.body.style.removeProperty("--ll-dialogue-color");
	document.body.style.removeProperty("--ll-narrative-color");
	document.body.style.removeProperty("--ll-table-color");
	document.body.style.removeProperty("--ll-generator-color");
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

interface ColorDef {
	key: keyof Pick<
		LonelogSettings,
		| "colorAction"
		| "colorQuestion"
		| "colorDice"
		| "colorConsequence"
		| "colorResult"
		| "colorTag"
		| "colorMeta"
		| "colorDialogue"
		| "colorNarrative"
		| "colorTable"
		| "colorGenerator"
	>;
	label: string;
	desc: string;
}

const COLOR_DEFS: ColorDef[] = [
	{ key: "colorAction", label: "Action (@)", desc: t("settings.colors-desc") },
	{ key: "colorQuestion", label: "Question (?)", desc: t("settings.colors-desc") },
	{ key: "colorDice", label: "Dice roll (d:)", desc: t("settings.colors-desc") },
	{ key: "colorConsequence", label: "Consequence (=>)", desc: t("settings.colors-desc") },
	{ key: "colorResult", label: "Result arrow (->)", desc: t("settings.colors-desc") },
	{ key: "colorTag", label: "Tags ([N:…] etc.)", desc: t("settings.colors-desc") },
	{ key: "colorMeta", label: t("settings.color-meta"), desc: t("settings.color-meta-desc") },
	{ key: "colorDialogue", label: t("settings.color-dialogue"), desc: t("settings.color-dialogue-desc") },
	{ key: "colorNarrative", label: t("settings.color-narrative"), desc: t("settings.color-narrative-desc") },
	{ key: "colorTable", label: t("settings.color-table"), desc: t("settings.color-table-desc") },
	{ key: "colorGenerator", label: t("settings.color-generator"), desc: t("settings.color-generator-desc") },
];

export class LonelogSettingTab extends PluginSettingTab {
	plugin: LonelogPlugin;

	constructor(app: App, plugin: LonelogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Interface / Language ───────────────────────────────────────────
		new Setting(containerEl).setName(t("settings.language-section")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.language"))
			.setDesc(t("settings.language-desc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("en", "English")
					.addOption("es", "Español")
					.setValue(this.plugin.settings.locale)
					.onChange(async (value) => {
						this.plugin.settings.locale = value;
						setLocale(value);
						await this.plugin.saveSettings();
						this.display(); // Refresh tab to update labels
					})
			);

		// ── Core Notation ──────────────────────────────────────────────────
		new Setting(containerEl).setName(t("settings.core-section")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.insert-space"))
			.setDesc(t("settings.insert-space-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.insertSpaceAfterSymbol)
					.onChange(async (value) => {
						this.plugin.settings.insertSpaceAfterSymbol = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.smart-cursor"))
			.setDesc(t("settings.smart-cursor-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.smartCursorPositioning)
					.onChange(async (value) => {
						this.plugin.settings.smartCursorPositioning = value;
						await this.plugin.saveSettings();
					})
			);

		// ── Templates ──────────────────────────────────────────────────────
		new Setting(containerEl).setName(t("settings.templates-section")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.auto-scene"))
			.setDesc(t("settings.auto-scene-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoIncrementScenes)
					.onChange(async (value) => {
						this.plugin.settings.autoIncrementScenes = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.prompt-context"))
			.setDesc(t("settings.prompt-context-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.promptForSceneContext)
					.onChange(async (value) => {
						this.plugin.settings.promptForSceneContext = value;
						await this.plugin.saveSettings();
					})
			);

		// ── Frontmatter ────────────────────────────────────────────────────
		new Setting(containerEl).setName(t("settings.frontmatter-section")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.default-ruleset"))
			.setDesc(t("settings.default-ruleset-desc"))
			.addText((text) =>
				text
					.setPlaceholder("e.g. Loner + Mythic Oracle")
					.setValue(this.plugin.settings.defaultRuleset)
					.onChange(async (value) => {
						this.plugin.settings.defaultRuleset = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.default-genre"))
			.setDesc(t("settings.default-genre-desc"))
			.addText((text) =>
				text
					.setPlaceholder("e.g. Teen mystery")
					.setValue(this.plugin.settings.defaultGenre)
					.onChange(async (value) => {
						this.plugin.settings.defaultGenre = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.default-player"))
			.setDesc(t("settings.default-player-desc"))
			.addText((text) =>
				text
					.setPlaceholder("e.g. Alex")
					.setValue(this.plugin.settings.defaultPlayer)
					.onChange(async (value) => {
						this.plugin.settings.defaultPlayer = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.default-themes"))
			.setDesc(t("settings.default-themes-desc"))
			.addText((text) =>
				text
					.setPlaceholder("e.g. Friendship, courage")
					.setValue(this.plugin.settings.defaultThemes)
					.onChange(async (value) => {
						this.plugin.settings.defaultThemes = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.default-tone"))
			.setDesc(t("settings.default-tone-desc"))
			.addText((text) =>
				text
					.setPlaceholder("e.g. Eerie but playful")
					.setValue(this.plugin.settings.defaultTone)
					.onChange(async (value) => {
						this.plugin.settings.defaultTone = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.auto-update-last-update"))
			.setDesc(t("settings.auto-update-last-update-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoUpdateLastUpdate)
					.onChange(async (value) => {
						this.plugin.settings.autoUpdateLastUpdate = value;
						await this.plugin.saveSettings();
					})
			);

		// ── Highlighting ───────────────────────────────────────────────────
		new Setting(containerEl).setName(t("settings.highlight-section")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.enable-editor"))
			.setDesc(t("settings.enable-editor-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableEditorHighlighting)
					.onChange(async (value) => {
						this.plugin.settings.enableEditorHighlighting = value;
						await this.plugin.saveSettings();
						// Suggest reload for extension changes to take effect
						if (!value) {
							containerEl.createEl("div", {
								text: "Reload Obsidian for this change to take full effect",
								cls: "setting-item-description mod-warning",
							});
						}
					})
			);

		new Setting(containerEl)
			.setName(t("settings.enable-reading"))
			.setDesc(t("settings.enable-reading-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableReadingHighlighting)
					.onChange(async (value) => {
						this.plugin.settings.enableReadingHighlighting = value;
						await this.plugin.saveSettings();
					})
			);

		// ── Extras & Interactive Tools ─────────────────────────────────────
		new Setting(containerEl).setName(t("settings.extras-section")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.enable-dice-roller"))
			.setDesc(t("settings.enable-dice-roller-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableDiceRoller)
					.onChange(async (value) => {
						this.plugin.settings.enableDiceRoller = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.dice-detail-mode"))
			.setDesc(t("settings.dice-detail-mode-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.diceDetailMode)
					.onChange(async (value) => {
						this.plugin.settings.diceDetailMode = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.show-dice-high"))
			.setDesc(t("settings.show-dice-high-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showDiceHigh)
					.onChange(async (value) => {
						this.plugin.settings.showDiceHigh = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.dice-high-label"))
			.setDesc(t("settings.dice-high-label-desc"))
			.addText((text) =>
				text
					.setPlaceholder("High")
					.setValue(this.plugin.settings.diceHighLabel)
					.onChange(async (value) => {
						this.plugin.settings.diceHighLabel = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.show-dice-low"))
			.setDesc(t("settings.show-dice-low-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showDiceLow)
					.onChange(async (value) => {
						this.plugin.settings.showDiceLow = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.dice-low-label"))
			.setDesc(t("settings.dice-low-label-desc"))
			.addText((text) =>
				text
					.setPlaceholder("Low")
					.setValue(this.plugin.settings.diceLowLabel)
					.onChange(async (value) => {
						this.plugin.settings.diceLowLabel = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName(t("settings.colors-header")).setHeading();
		containerEl.createEl("p", {
			text: t("settings.colors-desc"),
			cls: "setting-item-description",
		});

		for (const def of COLOR_DEFS) {
			this.addColorSetting(containerEl, def);
		}
	}

	private addColorSetting(containerEl: HTMLElement, def: ColorDef): void {
		const defaultValue = DEFAULT_SETTINGS[def.key];

		const setting = new Setting(containerEl)
			.setName(def.label)
			.setDesc(def.desc);

		// Add color picker
		const colorPickerContainer = setting.controlEl.createDiv({ cls: "lonelog-color-picker-container" });
		const colorPicker = colorPickerContainer.createEl("input", {
			type: "color",
			cls: "lonelog-color-picker",
		});

		// Convert current value to hex for color picker (best effort)
		colorPicker.value = this.normalizeColorForPicker(this.plugin.settings[def.key]);

		// Add text input
		setting.addText((text) => {
			text
				.setPlaceholder(defaultValue)
				.setValue(this.plugin.settings[def.key])
				.onChange(async (value) => {
					this.plugin.settings[def.key] = value || defaultValue;
					await this.plugin.saveSettings();
					applyHighlightColors(this.plugin.settings);
					// Update color picker if valid hex
					const normalized = this.normalizeColorForPicker(value);
					if (normalized) {
						colorPicker.value = normalized;
					}
				});
			text.inputEl.addClass("lonelog-color-input");

			// Sync color picker to text input
			colorPicker.addEventListener("input", () => {
				const hexValue = colorPicker.value;
				text.setValue(hexValue);
				this.plugin.settings[def.key] = hexValue;
				void this.plugin.saveSettings().then(() => {
					applyHighlightColors(this.plugin.settings);
				});
			});
		});

		// Add reset button
		setting.addButton((btn) => {
			btn
				.setIcon("rotate-ccw")
				.setTooltip("Reset to default")
				.onClick(async () => {
					this.plugin.settings[def.key] = defaultValue;
					await this.plugin.saveSettings();
					applyHighlightColors(this.plugin.settings);
					// Re-render the tab so the inputs reflect the reset value
					this.display();
				});
		});
	}

	/**
	 * Normalize a color value to hex format for the color picker.
	 * Handles hex values and common color names. Returns empty string if invalid.
	 */
	private normalizeColorForPicker(color: string): string {
		// Already a valid hex color
		if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
			return color;
		}

		// Try to use the browser to parse color names/other formats
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1;
		const ctx = canvas.getContext("2d");
		if (!ctx) return "#000000";

		ctx.fillStyle = color;
		const computedColor = ctx.fillStyle;

		// Convert rgb(a) to hex if needed
		if (computedColor.startsWith("#")) {
			return computedColor.length === 7 ? computedColor : "#000000";
		}

		// Parse rgb/rgba format
		const rgbMatch = computedColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
			const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
			const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
			const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
			return `#${r}${g}${b}`;
		}

		return "#000000";
	}
}
