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
	enableGlobalNotation: boolean;
	enableDiceRoller: boolean;
	enableCombatAddon: boolean;
	enableDungeonAddon: boolean;
	enableResourceAddon: boolean;
	enablePartylogAddon: boolean;
	enableCardAddon: boolean;
	enableDiceNotationAddon: boolean;

	// Dice roller output settings
	diceDetailMode: boolean;   // Show individual dice values instead of sum
	diceHighLabel: string;     // Label for the highest die
	showDiceHigh: boolean;     // Whether to show the high die annotation
	diceLowLabel: string;      // Label for the lowest die
	showDiceLow: boolean;      // Whether to show the low die annotation
	inlineCardDescriptions: boolean; // Automagically add the explicit // card name on draws

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
	colorScene: string;       // Scene — user-defined
	colorHeader: string;      // Header — user-defined
	colorRound: string;       // Rd# — user-defined
	colorCombatBlock: string; // [COMBAT] — user-defined
	colorFoe: string;         // [F:...] — user-defined
	colorRoom: string;        // [R:...] — user-defined
	colorDungeonBlock: string; // [DUNGEON STATUS] — user-defined
	colorInventory: string;   // [INV:...] — user-defined
	colorWealth: string;      // [WEALTH:...] — user-defined
	colorResourcesBlock: string; // [RESOURCES] — user-defined
	locale: string;           // Interface language
	defaultRibbonView: string; // View to open when ribbon is clicked
	tokenFontWeight: string;  // Boldness for tokens
	blockFontFamily: string; // Font family for the codeblocks
	blockFontSize: string; // Font size for the codeblocks
}

export const DEFAULT_SETTINGS: LonelogSettings = {
	insertSpaceAfterSymbol: true,
	smartCursorPositioning: true,
	autoIncrementScenes: true,
	promptForSceneContext: true,
	autoWrapInCodeBlock: false,

	// Phase 3 Defaults
	defaultRuleset: " ",
	defaultGenre: "",
	defaultPlayer: "",
	defaultThemes: "",
	defaultTone: "",
	autoUpdateLastUpdate: true,

	actionSequenceTemplate: "@ [action]\nd: [roll] -> [outcome]\n=> [consequence]",
	oracleSequenceTemplate: "? [question]\n-> [answer]\n=> [consequence]",

	// Highlighting toggles
	enableEditorHighlighting: true,
	enableReadingHighlighting: true,
	enableGlobalNotation: false,
	enableDiceRoller: true,
	enableCombatAddon: false,
	enableDungeonAddon: false,
	enableResourceAddon: false,
	enablePartylogAddon: false,
	enableCardAddon: false,
	enableDiceNotationAddon: false,

	// Dice output defaults
	diceDetailMode: false,
	diceHighLabel: "High",
	showDiceHigh: true,
	diceLowLabel: "Low",
	showDiceLow: true,
	inlineCardDescriptions: true,

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
	colorScene: "#3b82f6", // default blue
	colorHeader: "#3b82f6", // default blue
	colorRound: "#22c55e",  // default green
	colorCombatBlock: "#ef4444", // default red
	colorFoe: "#c2410c",    // default orange
	colorRoom: "#c2410c",    // default orange
	colorDungeonBlock: "#c2410c", // default orange
	colorInventory: "#0891b2", // default cyan (matches items)
	colorWealth: "#ca8a04",    // default yellow (matches gold)
	colorResourcesBlock: "#0891b2", // default cyan
	locale: "en",
	defaultRibbonView: "",
	tokenFontWeight: "normal",
	blockFontFamily: "",
	blockFontSize: "",
};

/** Sets Lonelog CSS custom properties on document.body */
export function applyHighlightColors(settings: LonelogSettings): void {
	const body = window.activeDocument.body;
	body.style.setProperty("--ll-action-color", settings.colorAction);
	body.style.setProperty("--ll-question-color", settings.colorQuestion);
	body.style.setProperty("--ll-dice-color", settings.colorDice);
	body.style.setProperty("--ll-consequence-color", settings.colorConsequence);
	body.style.setProperty("--ll-result-color", settings.colorResult);
	body.style.setProperty("--ll-tag-color", settings.colorTag);
	body.style.setProperty("--ll-meta-color", settings.colorMeta);
	body.style.setProperty("--ll-dialogue-color", settings.colorDialogue);
	body.style.setProperty("--ll-narrative-color", settings.colorNarrative);
	body.style.setProperty("--ll-table-color", settings.colorTable);
	body.style.setProperty("--ll-generator-color", settings.colorGenerator);
	body.style.setProperty("--ll-scene-color", settings.colorScene);
	body.style.setProperty("--ll-header-color", settings.colorHeader);
	body.style.setProperty("--ll-round-color", settings.colorRound);
	body.style.setProperty("--ll-combat-color", settings.colorCombatBlock);
	body.style.setProperty("--ll-foe-color", settings.colorFoe);
	body.style.setProperty("--ll-room-color", settings.colorRoom);
	body.style.setProperty("--ll-dungeon-block-color", settings.colorDungeonBlock);
	body.style.setProperty("--ll-inventory-color", settings.colorInventory);
	body.style.setProperty("--ll-wealth-color", settings.colorWealth);
	body.style.setProperty("--ll-resources-block-color", settings.colorResourcesBlock);

	if (settings.blockFontFamily) {
		body.style.setProperty("--ll-font-family", settings.blockFontFamily);
	} else {
		body.style.removeProperty("--ll-font-family");
	}

	if (settings.blockFontSize) {
		body.style.setProperty("--ll-font-size", settings.blockFontSize);
	} else {
		body.style.removeProperty("--ll-font-size");
	}
}

/** Removes the injected CSS custom properties (call from onunload). */
export function removeHighlightColors(): void {
	const body = window.activeDocument.body;
	body.style.removeProperty("--ll-action-color");
	body.style.removeProperty("--ll-question-color");
	body.style.removeProperty("--ll-dice-color");
	body.style.removeProperty("--ll-consequence-color");
	body.style.removeProperty("--ll-result-color");
	body.style.removeProperty("--ll-tag-color");
	body.style.removeProperty("--ll-meta-color");
	body.style.removeProperty("--ll-dialogue-color");
	body.style.removeProperty("--ll-narrative-color");
	body.style.removeProperty("--ll-table-color");
	body.style.removeProperty("--ll-generator-color");
	body.style.removeProperty("--ll-scene-color");
	body.style.removeProperty("--ll-header-color");
	body.style.removeProperty("--ll-round-color");
	body.style.removeProperty("--ll-combat-color");
	body.style.removeProperty("--ll-foe-color");
	body.style.removeProperty("--ll-room-color");
	body.style.removeProperty("--ll-dungeon-block-color");
	body.style.removeProperty("--ll-inventory-color");
	body.style.removeProperty("--ll-wealth-color");
	body.style.removeProperty("--ll-resources-block-color");
	body.style.removeProperty("--ll-font-family");
	body.style.removeProperty("--ll-font-size");
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
		| "colorScene"
		| "colorHeader"
		| "colorRound"
		| "colorCombatBlock"
		| "colorFoe"
		| "colorRoom"
		| "colorDungeonBlock"
		| "colorInventory"
		| "colorWealth"
		| "colorResourcesBlock"
	>;
	label: string;
	desc: string;
}

type SettingsSectionKey = "interface" | "notation" | "templates" | "colors" | "dice" | "addons" | "about";

function getColorDefs(): ColorDef[] {
	return [
		{ key: "colorAction", label: t("settings.color-action"), desc: t("settings.colors-desc") },
		{ key: "colorQuestion", label: t("settings.color-question"), desc: t("settings.colors-desc") },
		{ key: "colorDice", label: t("settings.color-dice"), desc: t("settings.colors-desc") },
		{ key: "colorConsequence", label: t("settings.color-consequence"), desc: t("settings.colors-desc") },
		{ key: "colorResult", label: t("settings.color-result"), desc: t("settings.colors-desc") },
		{ key: "colorTag", label: t("settings.color-tag"), desc: t("settings.colors-desc") },
		{ key: "colorMeta", label: t("settings.color-meta"), desc: t("settings.color-meta-desc") },
		{ key: "colorDialogue", label: t("settings.color-dialogue"), desc: t("settings.color-dialogue-desc") },
		{ key: "colorNarrative", label: t("settings.color-narrative"), desc: t("settings.color-narrative-desc") },
		{ key: "colorTable", label: t("settings.color-table"), desc: t("settings.color-table-desc") },
		{ key: "colorGenerator", label: t("settings.color-generator"), desc: t("settings.color-generator-desc") },
		{ key: "colorScene", label: t("settings.color-scene"), desc: t("settings.color-scene-desc") },
		{ key: "colorHeader", label: t("settings.color-session"), desc: t("settings.color-session-desc") },
		{ key: "colorRound", label: t("settings.color-round"), desc: t("settings.color-round-desc") },
		{ key: "colorCombatBlock", label: t("settings.color-combat"), desc: t("settings.color-combat-desc") },
		{ key: "colorFoe", label: t("settings.color-foe"), desc: t("settings.color-foe-desc") },
		{ key: "colorRoom", label: t("settings.color-room"), desc: t("settings.color-room-desc") },
		{ key: "colorDungeonBlock", label: t("settings.color-dungeon-block"), desc: t("settings.color-dungeon-block-desc") },
		{ key: "colorInventory", label: t("settings.color-inventory"), desc: t("settings.color-inventory-desc") },
		{ key: "colorWealth", label: t("settings.color-wealth"), desc: t("settings.color-wealth-desc") },
		{ key: "colorResourcesBlock", label: t("settings.color-resources-block"), desc: t("settings.color-resources-block-desc") },
	];
}

export class LonelogSettingTab extends PluginSettingTab {
	plugin: LonelogPlugin;
	private activeSection: SettingsSectionKey = "interface";

	constructor(app: App, plugin: LonelogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.render();
	}

	private render(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("lonelog-settings-tab");

		const shellEl = containerEl.createDiv({ cls: "lonelog-settings-shell" });
		const sidebarEl = shellEl.createDiv({ cls: "lonelog-settings-sidebar" });
		const contentEl = shellEl.createDiv({ cls: "lonelog-settings-content" });

		this.renderSidebar(sidebarEl);
		this.renderPanel(contentEl);
	}

	private renderSidebar(containerEl: HTMLElement): void {
		containerEl.empty();
		containerEl.createEl("div", { cls: "lonelog-settings-sidebar-title", text: t("settings.header") });

		const sections: Array<{ key: SettingsSectionKey; label: string }> = [
			{ key: "interface", label: t("settings.nav-interface") },
			{ key: "notation", label: t("settings.nav-notation") },
			{ key: "templates", label: t("settings.nav-templates") },
			{ key: "colors", label: t("settings.nav-colors") },
			{ key: "dice", label: t("settings.nav-dice") },
			{ key: "addons", label: t("settings.nav-addons") },
			{ key: "about", label: t("settings.nav-about") },
		];

		const navEl = containerEl.createDiv({ cls: "lonelog-settings-nav" });
		for (const section of sections) {
			const button = navEl.createEl("button", {
				cls: section.key === this.activeSection
					? "lonelog-settings-nav-item is-active"
					: "lonelog-settings-nav-item",
				text: section.label,
			});

				button.addEventListener("click", () => {
					if (this.activeSection === section.key) return;
					this.activeSection = section.key;
					this.render();
				});
			}
		}

	private renderPanel(containerEl: HTMLElement): void {
		containerEl.empty();
		const titleSetting = new Setting(containerEl).setName(this.getSectionTitle(this.activeSection)).setHeading();
		titleSetting.settingEl.addClass("lonelog-settings-panel-heading");

		switch (this.activeSection) {
			case "interface":
				this.renderInterfacePanel(containerEl);
				break;
			case "notation":
				this.renderNotationPanel(containerEl);
				break;
			case "templates":
				this.renderTemplatesPanel(containerEl);
				break;
			case "colors":
				this.renderColorsPanel(containerEl);
				break;
			case "dice":
				this.renderDicePanel(containerEl);
				break;
			case "addons":
				this.renderAddonsPanel(containerEl);
				break;
			case "about":
				this.renderAboutPanel(containerEl);
				break;
		}
	}

	private getSectionTitle(section: SettingsSectionKey): string {
		const titles: Record<SettingsSectionKey, string> = {
			interface: t("settings.nav-interface"),
			notation: t("settings.nav-notation"),
			templates: t("settings.nav-templates"),
			colors: t("settings.nav-colors"),
			dice: t("settings.nav-dice"),
			addons: t("settings.nav-addons"),
			about: t("settings.nav-about"),
		};
		return titles[section];
	}

	private renderSubsection(containerEl: HTMLElement, title: string): HTMLElement {
		const sectionEl = containerEl.createDiv({ cls: "lonelog-settings-subsection" });
		const headingSetting = new Setting(sectionEl).setName(title).setHeading();
		headingSetting.settingEl.addClass("lonelog-settings-subsection-heading");
		return sectionEl;
	}

	private addAddonBadge(setting: Setting, enabled: boolean): void {
		setting.nameEl.createSpan({
			cls: enabled ? "lonelog-addon-badge is-active" : "lonelog-addon-badge",
			text: enabled ? t("settings.status-active") : t("settings.status-inactive"),
		});
	}

	private renderInterfacePanel(containerEl: HTMLElement): void {
		const languageSection = this.renderSubsection(containerEl, t("settings.subsection-language-view"));

		new Setting(languageSection)
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
							this.render();
						})
				);

		new Setting(languageSection)
			.setName(t("settings.default-view"))
			.setDesc(t("settings.default-view-desc"))
			.addDropdown((dropdown) =>
				{
					dropdown
						.addOption("", t("settings.none"))
						.addOption("lonelog-dashboard", t("views.dashboard-title"))
						.addOption("lonelog-progress-view", t("views.progress-title"))
						.addOption("lonelog-thread-view", t("views.thread-title"))
						.addOption("lonelog-scene-nav", t("views.scene-title"))
						.addOption("lonelog-combat-view", t("views.combat-tracker-title"))
						.addOption("lonelog-partylog-dashboard", t("views.partylog-dashboard-title"));

					dropdown
						.setValue(this.plugin.settings.defaultRibbonView)
						.onChange(async (value) => {
							this.plugin.settings.defaultRibbonView = value;
							await this.plugin.saveSettings();
						});
				}
			);

		const editorSection = this.renderSubsection(containerEl, t("settings.subsection-syntax-editor"));

		new Setting(editorSection)
			.setName(t("settings.token-font-weight"))
			.setDesc(t("settings.token-font-weight-desc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("bold", t("settings.weight-bold"))
					.addOption("normal", t("settings.weight-normal"))
					.setValue(this.plugin.settings.tokenFontWeight)
					.onChange(async (value) => {
						this.plugin.settings.tokenFontWeight = value;
						await this.plugin.saveSettings();
						if (typeof this.plugin.applyFontWeightSetting === "function") {
							this.plugin.applyFontWeightSetting();
						}
					})
			);

		new Setting(editorSection)
			.setName(t("settings.block-font-family"))
			.setDesc(t("settings.block-font-family-desc"))
			.addText((text) =>
				text
					.setPlaceholder("Consolas, monospace")
					.setValue(this.plugin.settings.blockFontFamily)
					.onChange(async (value) => {
						this.plugin.settings.blockFontFamily = value;
						await this.plugin.saveSettings();
						applyHighlightColors(this.plugin.settings);
					})
			);

		new Setting(editorSection)
			.setName(t("settings.block-font-size"))
			.setDesc(t("settings.block-font-size-desc"))
			.addText((text) =>
				text
					.setPlaceholder("14px, 1.2em")
					.setValue(this.plugin.settings.blockFontSize)
					.onChange(async (value) => {
						this.plugin.settings.blockFontSize = value;
						await this.plugin.saveSettings();
						applyHighlightColors(this.plugin.settings);
					})
			);

		new Setting(editorSection)
			.setName(t("settings.enable-editor"))
			.setDesc(t("settings.enable-editor-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableEditorHighlighting)
					.onChange(async (value) => {
						this.plugin.settings.enableEditorHighlighting = value;
						await this.plugin.saveSettings();
						if (!value) {
							editorSection.createEl("div", {
								text: t("settings.reload-warning"),
								cls: "setting-item-description mod-warning",
							});
						}
					})
			);

		new Setting(editorSection)
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

		new Setting(editorSection)
			.setName(t("settings.enable-global"))
			.setDesc(t("settings.enable-global-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableGlobalNotation)
					.onChange(async (value) => {
						this.plugin.settings.enableGlobalNotation = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderNotationPanel(containerEl: HTMLElement): void {
		const insertSection = this.renderSubsection(containerEl, t("settings.subsection-insertion"));

		new Setting(insertSection)
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

		new Setting(insertSection)
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
	}

	private renderTemplatesPanel(containerEl: HTMLElement): void {
		const scenesSection = this.renderSubsection(containerEl, t("settings.subsection-scenes"));

		new Setting(scenesSection)
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

		new Setting(scenesSection)
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

		const frontmatterSection = this.renderSubsection(containerEl, t("settings.subsection-frontmatter-defaults"));

		new Setting(frontmatterSection)
			.setName(t("settings.default-ruleset"))
			.setDesc(t("settings.default-ruleset-desc"))
			.addText((text) =>
				text
					.setPlaceholder("Loner + mythic oracle")
					.setValue(this.plugin.settings.defaultRuleset)
					.onChange(async (value) => {
						this.plugin.settings.defaultRuleset = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(frontmatterSection)
			.setName(t("settings.default-genre"))
			.setDesc(t("settings.default-genre-desc"))
			.addText((text) =>
				text
					.setPlaceholder("Teen mystery")
					.setValue(this.plugin.settings.defaultGenre)
					.onChange(async (value) => {
						this.plugin.settings.defaultGenre = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(frontmatterSection)
			.setName(t("settings.default-player"))
			.setDesc(t("settings.default-player-desc"))
			.addText((text) =>
				text
					.setPlaceholder("Alex")
					.setValue(this.plugin.settings.defaultPlayer)
					.onChange(async (value) => {
						this.plugin.settings.defaultPlayer = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(frontmatterSection)
			.setName(t("settings.default-themes"))
			.setDesc(t("settings.default-themes-desc"))
			.addText((text) =>
				text
					.setPlaceholder("Friendship, courage")
					.setValue(this.plugin.settings.defaultThemes)
					.onChange(async (value) => {
						this.plugin.settings.defaultThemes = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(frontmatterSection)
			.setName(t("settings.default-tone"))
			.setDesc(t("settings.default-tone-desc"))
			.addText((text) =>
				text
					.setPlaceholder("Eerie but playful")
					.setValue(this.plugin.settings.defaultTone)
					.onChange(async (value) => {
						this.plugin.settings.defaultTone = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(frontmatterSection)
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
	}

	private renderColorsPanel(containerEl: HTMLElement): void {
		containerEl.createEl("p", {
			text: t("settings.colors-desc"),
			cls: "setting-item-description lonelog-settings-panel-description",
		});

		const mainSection = this.renderSubsection(containerEl, t("settings.subsection-main-tokens"));
		for (const def of getColorDefs().slice(0, 7)) {
			this.addColorSetting(mainSection, def);
		}

		const narrativeSection = this.renderSubsection(containerEl, t("settings.subsection-narrative-tokens"));
		for (const def of getColorDefs().slice(7, 9)) {
			this.addColorSetting(narrativeSection, def);
		}

		const addonSection = this.renderSubsection(containerEl, t("settings.subsection-addon-tokens"));
		for (const def of getColorDefs().slice(9)) {
			this.addColorSetting(addonSection, def);
		}
	}

	private renderDicePanel(containerEl: HTMLElement): void {
		const rollerSection = this.renderSubsection(containerEl, t("settings.subsection-roller"));

		new Setting(rollerSection)
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

		const detailSection = this.renderSubsection(containerEl, t("settings.subsection-detail-mode"));

		new Setting(detailSection)
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

		new Setting(detailSection)
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

		new Setting(detailSection)
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

		new Setting(detailSection)
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

		new Setting(detailSection)
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

		new Setting(detailSection)
			.setName(t("settings.card-inline-descriptions"))
			.setDesc(t("settings.card-inline-descriptions-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.inlineCardDescriptions)
					.onChange(async (value) => {
						this.plugin.settings.inlineCardDescriptions = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderAddonsPanel(containerEl: HTMLElement): void {
		const partylogSection = this.renderSubsection(containerEl, t("settings.subsection-partylog"));
		const partylogSetting = new Setting(partylogSection)
			.setName(t("settings.enable-partylog"))
			.setDesc(t("settings.enable-partylog-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enablePartylogAddon)
					.onChange(async (value) => {
						this.plugin.settings.enablePartylogAddon = value;
						await this.plugin.saveSettings();
						this.render();
					})
			);
		this.addAddonBadge(partylogSetting, this.plugin.settings.enablePartylogAddon);

		const combatSection = this.renderSubsection(containerEl, t("settings.subsection-combat-exploration"));
		const combatSetting = new Setting(combatSection)
			.setName(t("settings.enable-combat"))
			.setDesc(t("settings.enable-combat-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableCombatAddon)
						.onChange(async (value) => {
							this.plugin.settings.enableCombatAddon = value;
							await this.plugin.saveSettings();
							this.render();
						})
				);
		this.addAddonBadge(combatSetting, this.plugin.settings.enableCombatAddon);

		const dungeonSetting = new Setting(combatSection)
			.setName(t("settings.enable-dungeon"))
			.setDesc(t("settings.enable-dungeon-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableDungeonAddon)
						.onChange(async (value) => {
							this.plugin.settings.enableDungeonAddon = value;
							await this.plugin.saveSettings();
							this.render();
						})
				);
		this.addAddonBadge(dungeonSetting, this.plugin.settings.enableDungeonAddon);

		const resourceSection = this.renderSubsection(containerEl, t("settings.subsection-resources-inventory"));
		const resourcesSetting = new Setting(resourceSection)
			.setName(t("settings.enable-resources"))
			.setDesc(t("settings.enable-resources-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableResourceAddon)
						.onChange(async (value) => {
							this.plugin.settings.enableResourceAddon = value;
							await this.plugin.saveSettings();
							this.render();
						})
				);
		this.addAddonBadge(resourcesSetting, this.plugin.settings.enableResourceAddon);

		const cardsSection = this.renderSubsection(containerEl, t("settings.subsection-cards-advanced-dice"));
		const cardSetting = new Setting(cardsSection)
			.setName(t("settings.enable-card"))
			.setDesc(t("settings.enable-card-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableCardAddon)
						.onChange(async (value) => {
							this.plugin.settings.enableCardAddon = value;
							await this.plugin.saveSettings();
							this.render();
						})
				);
		this.addAddonBadge(cardSetting, this.plugin.settings.enableCardAddon);

		const diceNotationSetting = new Setting(cardsSection)
			.setName(t("settings.enable-dice-notation"))
			.setDesc(t("settings.enable-dice-notation-desc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableDiceNotationAddon)
						.onChange(async (value) => {
							this.plugin.settings.enableDiceNotationAddon = value;
							await this.plugin.saveSettings();
							this.render();
						})
				);
		this.addAddonBadge(diceNotationSetting, this.plugin.settings.enableDiceNotationAddon);
	}

	private renderAboutPanel(containerEl: HTMLElement): void {
		const versionSection = this.renderSubsection(containerEl, t("settings.subsection-version"));
		versionSection.createDiv({ cls: "lonelog-version-badge", text: this.plugin.manifest.version });

		const authorSection = this.renderSubsection(containerEl, t("settings.subsection-authorship"));
		const aboutDesc = authorSection.createDiv({ cls: "lonelog-about-container" });

		const systemRow = aboutDesc.createDiv({ cls: "lonelog-about-row" });
		systemRow.createSpan({ text: "🖋️ " });
		systemRow.createEl("a", {
			text: t("settings.about-system"),
			href: "https://zeruhur.itch.io/lonelog",
			cls: "lonelog-about-text",
		});

		const devRow = aboutDesc.createDiv({ cls: "lonelog-about-row" });
		devRow.createSpan({ text: "💻 " });
		devRow.createSpan({ text: t("settings.about-dev"), cls: "lonelog-about-text" });

		const linksSection = this.renderSubsection(containerEl, t("settings.subsection-links"));
		const linksCol = linksSection.createDiv({ cls: "lonelog-about-links" });

		linksCol.createEl("a", {
			text: t("settings.youtube-link"),
			href: "https://www.youtube.com/@BastiondelDinosaurio",
			cls: "lonelog-about-link",
		});
		linksCol.createSpan({ text: "•", cls: "lonelog-link-separator" });
		linksCol.createEl("a", {
			text: t("settings.paypal-link"),
			href: "https://paypal.me/sniferl4bs",
			cls: "lonelog-about-link",
		});
		linksCol.createSpan({ text: "•", cls: "lonelog-link-separator" });
		linksCol.createEl("a", {
			text: t("settings.funding-link"),
			href: "https://ko-fi.com/bastiondeldino",
			cls: "lonelog-about-link",
		});
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
				.setTooltip(t("settings.reset-default"))
				.onClick(async () => {
					this.plugin.settings[def.key] = defaultValue;
					await this.plugin.saveSettings();
					applyHighlightColors(this.plugin.settings);
					// Re-render the tab so the inputs reflect the reset value
					this.render();
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
		const canvas = this.containerEl.ownerDocument.createElement("canvas");
		canvas.width = canvas.height = 1;
		const ctx = canvas.getContext("2d");
		if (!ctx) return "#000000";

		ctx.fillStyle = color;
		const computedColor = String(ctx.fillStyle);

		// Convert rgb(a) to hex if needed
		if (computedColor.startsWith("#")) {
			return computedColor.length === 7 ? computedColor : "#000000";
		}

		// Parse rgb/rgba format
		const rgbMatch = computedColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
			const r = Number.parseInt(rgbMatch[1], 10).toString(16).padStart(2, "0");
			const g = Number.parseInt(rgbMatch[2], 10).toString(16).padStart(2, "0");
			const b = Number.parseInt(rgbMatch[3], 10).toString(16).padStart(2, "0");
			return `#${r}${g}${b}`;
		}

		return "#000000";
	}
}
