import { Menu, MenuItem, Plugin, TFile } from "obsidian";
import { setLocale, t } from "./i18n/i18n";
import {
	DEFAULT_SETTINGS, LonelogSettings, LonelogSettingTab, applyHighlightColors, removeHighlightColors
} from "./settings";
import { NotationCommands } from "./commands/notation";
import { TemplateCommands } from "./commands/templates";
import { FrontmatterCommands } from "./commands/frontmatter";
import { LonelogAutoComplete } from "./utils/autocomplete";
import { ProgressTrackerView, PROGRESS_VIEW_TYPE } from "./ui/progress-view";
import { ThreadBrowserView, THREAD_VIEW_TYPE } from "./ui/thread-view";
import { SceneNavigatorView, SCENE_NAV_TYPE } from "./ui/scene-nav";
import { DASHBOARD_VIEW_TYPE, DashboardView } from "ui/dashboard-view";
import { CombatTrackerView, COMBAT_VIEW_TYPE } from "./ui/combat-view";
import { DungeonStatusView, DUNGEON_VIEW_TYPE } from "./ui/dungeon-view";
import { ResourceStatusView, RESOURCE_VIEW_TYPE } from "./ui/resource-view";
import { lonelogBlockProcessor, lonelogGlobalProcessor } from "./utils/reading-highlighter";
import { lonelogEditorPlugin } from "./utils/editor-highlighter";

export default class LonelogPlugin extends Plugin {
	settings: LonelogSettings;
	autoComplete: LonelogAutoComplete;

	async onload() {
		console.debug("Loading Lonelog plugin");

		await this.loadSettings();

		// Set locale from settings
		setLocale(this.settings.locale || "en");

		// Apply the token font weight from settings
		this.applyFontWeightSetting();

		// Register reading mode highlighting (if enabled)
		if (this.settings.enableReadingHighlighting) {
			this.registerMarkdownCodeBlockProcessor(
				"lonelog",
				lonelogBlockProcessor(this.app, this.settings)
			);

			// Register global notation processor if enabled
			if (this.settings.enableGlobalNotation) {
				this.registerMarkdownPostProcessor(
					lonelogGlobalProcessor(this.app, this.settings)
				);
			}
		}

		applyHighlightColors(this.settings);

		// Register editor syntax highlighting (if enabled)
		if (this.settings.enableEditorHighlighting) {
			this.registerEditorExtension(lonelogEditorPlugin(this.settings));
		}

		// Register views
		this.registerView(
			PROGRESS_VIEW_TYPE,
			(leaf) => new ProgressTrackerView(leaf)
		);
		this.registerView(
			THREAD_VIEW_TYPE,
			(leaf) => new ThreadBrowserView(leaf)
		);
		this.registerView(
			SCENE_NAV_TYPE,
			(leaf) => new SceneNavigatorView(leaf)
		);
		this.registerView(
			DASHBOARD_VIEW_TYPE,
			(leaf) => new DashboardView(leaf, this)
		);
		this.registerView(
			COMBAT_VIEW_TYPE,
			(leaf) => new CombatTrackerView(leaf)
		);
		this.registerView(
			DUNGEON_VIEW_TYPE,
			(leaf) => new DungeonStatusView(leaf)
		);
		this.registerView(
			RESOURCE_VIEW_TYPE,
			(leaf) => new ResourceStatusView(leaf)
		);

		// Detach all views
		this.app.workspace.detachLeavesOfType(PROGRESS_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(THREAD_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(SCENE_NAV_TYPE);
		this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(COMBAT_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(DUNGEON_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(RESOURCE_VIEW_TYPE);

		// Register auto-completion
		this.autoComplete = new LonelogAutoComplete(this.app);
		this.registerEditorSuggest(this.autoComplete);

		// Add Ribbon Icon for View Selector
		const ribbonIconEl = this.addRibbonIcon("layout-list", "Lonelog views", (evt: MouseEvent) => {
			if (this.settings.defaultRibbonView) {
				// Left click with default set: activate it
				void this.activateView(this.settings.defaultRibbonView);
			} else {
				// No default: show menu
				this.showViewSelectorMenu(evt);
			}
		});

		ribbonIconEl.addEventListener("contextmenu", (evt: MouseEvent) => {
			evt.preventDefault();
			this.showViewSelectorMenu(evt);
		});

		// Handle frontmatter updates on file modification
		this.registerEvent(
			this.app.vault.on("modify", async (file) => {
				if (!this.settings.autoUpdateLastUpdate) return;

				// Ensure it's a markdown file
				if (!(file instanceof TFile) || file.extension !== "md") return;

				// Use metadataCache to see if it's a Lonelog note
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache || !cache.frontmatter) return;

				const fm = cache.frontmatter;
				// Check if it looks like a Lonelog note (has ruleset, start_date or lonelog tags)
				if (fm.ruleset !== undefined || fm.start_date !== undefined || fm.lonelog !== undefined) {
					const today = new Date().toISOString().split("T")[0];
					if (fm.last_update !== today) {
						// Update the frontmatter
						await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, string | number | boolean | undefined>) => {
							frontmatter.last_update = today;
						});
					}
				}
			})
		);

		// Register all commands
		this.registerCommands();

		// Add settings tab
		this.addSettingTab(new LonelogSettingTab(this.app, this));

	}

	onunload() {
		removeHighlightColors();
		document.body.classList.remove("ll-reduced-boldness");
		console.debug("Unloading Lonelog plugin");
	}

	applyFontWeightSetting() {
		if (this.settings.tokenFontWeight === "normal") {
			document.body.classList.add("ll-reduced-boldness");
		} else {
			document.body.classList.remove("ll-reduced-boldness");
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData() as Partial<LonelogSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	registerCommands(): void {
		// Single symbol commands
		this.addCommand({
			id: "insert-action",
			name: t("commands.insert-action"),
			editorCallback: (editor) => {
				NotationCommands.insertAction(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-question",
			name: t("commands.insert-question"),
			editorCallback: (editor) => {
				NotationCommands.insertQuestion(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-dice-roll",
			name: t("commands.insert-dice-roll"),
			editorCallback: (editor) => {
				NotationCommands.insertDiceRoll(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-result",
			name: t("commands.insert-result"),
			editorCallback: (editor) => {
				NotationCommands.insertResult(editor, this.settings);
			},
		});

		this.addCommand({
			id: "roll-dice-on-line",
			name: t("commands.roll-dice-on-line"),
			editorCallback: (editor) => {
				NotationCommands.rollDiceOnLine(editor, this.settings);
			},
		});


		this.addCommand({
			id: "insert-consequence",
			name: t("commands.insert-consequence"),
			editorCallback: (editor) => {
				NotationCommands.insertConsequence(editor, this.settings);
			},
		});

		// Multi-line pattern commands
		this.addCommand({
			id: "insert-action-sequence",
			name: t("commands.insert-action-sequence"),
			editorCallback: (editor) => {
				NotationCommands.insertActionSequence(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-oracle-sequence",
			name: t("commands.insert-oracle-sequence"),
			editorCallback: (editor) => {
				NotationCommands.insertOracleSequence(editor, this.settings);
			},
		});

		// Tag snippet commands
		this.addCommand({
			id: "insert-npc-tag",
			name: t("commands.insert-npc-tag"),
			editorCallback: (editor) => {
				NotationCommands.insertNPCTag(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-location-tag",
			name: t("commands.insert-location-tag"),
			editorCallback: (editor) => {
				NotationCommands.insertLocationTag(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-event-clock",
			name: t("commands.insert-event-clock"),
			editorCallback: (editor) => {
				NotationCommands.insertEventClock(this.app, editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-track",
			name: t("commands.insert-track"),
			editorCallback: (editor) => {
				NotationCommands.insertTrack(this.app, editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-thread",
			name: t("commands.insert-thread"),
			editorCallback: (editor) => {
				NotationCommands.insertThread(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-pc-tag",
			name: t("commands.insert-pc-tag"),
			editorCallback: (editor) => {
				NotationCommands.insertPCTag(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-timer",
			name: t("commands.insert-timer"),
			editorCallback: (editor) => {
				NotationCommands.insertTimer(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-reference",
			name: t("commands.insert-reference"),
			editorCallback: (editor) => {
				NotationCommands.insertReference(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-combat-block",
			name: t("commands.insert-combat-block"),
			editorCallback: (editor) => {
				NotationCommands.insertCombatBlock(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-round-marker",
			name: t("commands.insert-round-marker"),
			editorCallback: (editor) => {
				NotationCommands.insertRoundMarker(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-foe-tag",
			name: t("commands.insert-foe-tag"),
			editorCallback: (editor) => {
				NotationCommands.insertFoeTag(editor, this.settings);
			},
		});

		this.addCommand({
			id: "insert-room-tag",
			name: t("commands.insert-room-tag"),
			editorCheckCallback: (checking: boolean, editor) => {
				if (checking) return this.settings.enableDungeonAddon;
				if (editor) NotationCommands.insertRoomTag(editor, this.settings);
				return true;
			},
		});

		this.addCommand({
			id: "insert-dungeon-status",
			name: t("commands.insert-dungeon-status"),
			editorCheckCallback: (checking: boolean, editor) => {
				if (checking) return this.settings.enableDungeonAddon;
				if (editor) NotationCommands.insertDungeonStatus(editor, this.settings);
				return true;
			},
		});

		this.addCommand({
			id: "insert-inventory-tag",
			name: t("commands.insert-inventory-tag"),
			editorCheckCallback: (checking: boolean, editor) => {
				if (checking) return this.settings.enableResourceAddon;
				if (editor) NotationCommands.insertInventoryTag(editor, this.settings);
				return true;
			},
		});

		this.addCommand({
			id: "insert-wealth-tag",
			name: t("commands.insert-wealth-tag"),
			editorCheckCallback: (checking: boolean, editor) => {
				if (checking) return this.settings.enableResourceAddon;
				if (editor) NotationCommands.insertWealthTag(editor, this.settings);
				return true;
			},
		});

		this.addCommand({
			id: "insert-resources-block",
			name: t("commands.insert-resources-block"),
			editorCheckCallback: (checking: boolean, editor) => {
				if (checking) return this.settings.enableResourceAddon;
				if (editor) NotationCommands.insertResourcesBlock(editor, this.settings);
				return true;
			},
		});

		// Phase 2: Template commands
		this.addCommand({
			id: "insert-campaign-header",
			name: t("commands.insert-campaign-header"),
			editorCallback: (editor) => {
				TemplateCommands.insertCampaignHeader(this.app, editor);
			},
		});

		this.addCommand({
			id: "insert-session-header",
			name: t("commands.insert-session-header"),
			editorCallback: (editor) => {
				TemplateCommands.insertSessionHeader(editor);
			},
		});

		this.addCommand({
			id: "insert-scene-marker",
			name: t("commands.insert-scene-marker"),
			editorCallback: (editor) => {
				TemplateCommands.insertSceneMarker(
					this.app,
					editor,
					this.settings.promptForSceneContext
				);
			},
		});

		this.addCommand({
			id: "insert-scene-return",
			name: t("commands.insert-scene-return"),
			editorCallback: (editor) => {
				TemplateCommands.insertSceneMarker(
					this.app,
					editor,
					this.settings.promptForSceneContext,
					true
				);
			},
		});

		this.addCommand({
			id: "toggle-code-block",
			name: t("commands.toggle-code-block"),
			editorCallback: (editor) => {
				TemplateCommands.toggleCodeBlock(editor);
			},
		});

		// Phase 3: Frontmatter commands
		this.addCommand({
			id: "initialize-note-properties",
			name: t("commands.init-lonelog-note"),
			editorCallback: (editor, ctx) => {
				const file = this.app.workspace.getActiveFile();
				if (file) {
					void FrontmatterCommands.initializeNote(this.app, file, this.settings);
				}
			},
		});

		// Panel commands
		this.addCommand({
			id: "open-progress-tracker",
			name: t("commands.open-progress-tracker"),
			callback: () => {
				void this.activateView(PROGRESS_VIEW_TYPE);
			},
		});

		this.addCommand({
			id: "open-thread-browser",
			name: t("commands.open-thread-browser"),
			callback: () => {
				void this.activateView(THREAD_VIEW_TYPE);
			},
		});

		this.addCommand({
			id: "open-scene-navigator",
			name: t("commands.open-scene-navigator"),
			callback: () => {
				void this.activateView(SCENE_NAV_TYPE);
			},
		});

		this.addCommand({
			id: "show-dashboard",
			name: t("commands.show-dashboard"),
			callback: () => {
				void this.activateView(DASHBOARD_VIEW_TYPE);
			},
		});

		this.addCommand({
			id: "show-combat-tracker",
			name: t("commands.open-combat-tracker"),
			callback: () => {
				void this.activateView(COMBAT_VIEW_TYPE);
			},
		});

		this.addCommand({
			id: "open-dungeon-status",
			name: t("commands.open-dungeon-status"),
			callback: () => {
				void this.activateView(DUNGEON_VIEW_TYPE);
			},
		});

		this.addCommand({
			id: "open-resources",
			name: t("commands.open-resources"), // I need to add this
			callback: () => {
				void this.activateView(RESOURCE_VIEW_TYPE);
			},
		});

		this.addCommand({
			id: "open-view-selector",
			name: t("commands.open-view-selector"),
			callback: () => {
				// Use undefined to center the menu if called from command palette
				this.showViewSelectorMenu(undefined);
			},
		});
	}

	async activateView(viewType: string) {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(viewType)[0];

		if (!leaf) {
			if (viewType === DASHBOARD_VIEW_TYPE) {
				// Create new leaf in the main workspace (tab)
				leaf = workspace.getLeaf('tab');
			} else {
				// Create new leaf in right sidebar
				const rightLeaf = workspace.getRightLeaf(false);
				if (!rightLeaf) return;
				leaf = rightLeaf;
			}
			
			await leaf.setViewState({
				type: viewType,
				active: true,
			});
		}

		// Reveal the leaf
		void workspace.revealLeaf(leaf);
	}

	/**
	 * Shows a menu to select which Lonelog view to open
	 */
	showViewSelectorMenu(evt?: MouseEvent) {
		const menu = new Menu();

		const views = [
			{ id: DASHBOARD_VIEW_TYPE, name: t("views.dashboard-title"), icon: "layout-dashboard" },
			{ id: PROGRESS_VIEW_TYPE, name: t("views.progress-title"), icon: "clock" },
			{ id: THREAD_VIEW_TYPE, name: t("views.thread-title"), icon: "list" },
			{ id: SCENE_NAV_TYPE, name: t("views.scene-title"), icon: "map" },
			{ id: COMBAT_VIEW_TYPE, name: t("views.combat-tracker-title"), icon: "swords" },
			{ id: DUNGEON_VIEW_TYPE, name: t("views.dungeon-title"), icon: "map" },
			{ id: RESOURCE_VIEW_TYPE, name: t("views.resources-header"), icon: "coins" },
		];

		views.forEach((view) => {
			const isDefault = this.settings.defaultRibbonView === view.id;
			
			menu.addItem((item) => {
				item
					.setTitle(view.name + (isDefault ? " (Default)" : ""))
					.setIcon(view.icon)
					.onClick(() => {
						void this.activateView(view.id);
					});
			});
		});

		menu.addSeparator();

		// Add "Set as Default" submenu
		menu.addItem((item) => {
			item
				.setTitle(t("settings.default-view"))
				.setIcon("pin");
			
			const submenuItem = item as MenuItem & { setSubmenu: () => Menu, submenu: Menu };
			
			if (typeof submenuItem.setSubmenu === "function") {
				submenuItem.setSubmenu()
					.addItem((sub: MenuItem) => {
						sub.setTitle(t("settings.none"))
						   .setIcon("x")
						   .onClick(async () => {
							   this.settings.defaultRibbonView = "";
							   await this.saveSettings();
						   });
					});
				
				views.forEach((v) => {
					submenuItem.submenu.addItem((sub: MenuItem) => {
						sub.setTitle(v.name)
						   .setIcon(v.icon)
						   .onClick(async () => {
							   this.settings.defaultRibbonView = v.id;
							   await this.saveSettings();
						   });
					});
				});
			}
		});

		if (evt) {
			menu.showAtMouseEvent(evt);
		} else {
			// Center if no event (e.g. from command palette)
			menu.showAtPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
		}
	}
}
