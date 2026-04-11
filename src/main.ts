import { Plugin, TFile } from "obsidian";
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
import { lonelogBlockProcessor } from "./utils/reading-highlighter";
import { lonelogEditorPlugin } from "./utils/editor-highlighter";

export default class LonelogPlugin extends Plugin {
	settings: LonelogSettings;
	autoComplete: LonelogAutoComplete;

	async onload() {
		console.debug("Loading Lonelog plugin");

		await this.loadSettings();

		// Set locale from settings
		setLocale(this.settings.locale || "en");

		// Register reading mode highlighting (if enabled)
		if (this.settings.enableReadingHighlighting) {
			this.registerMarkdownCodeBlockProcessor(
				"lonelog",
				lonelogBlockProcessor(this.app, this.settings)
			);
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

		// Detach all views
		this.app.workspace.detachLeavesOfType(PROGRESS_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(THREAD_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(SCENE_NAV_TYPE);

		// Register auto-completion
		this.autoComplete = new LonelogAutoComplete(this.app);
		this.registerEditorSuggest(this.autoComplete);

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
						await this.app.fileManager.processFrontMatter(file as TFile, (frontmatter) => {
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
		console.debug("Unloading Lonelog plugin");
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
			id: "toggle-code-block",
			name: t("commands.toggle-code-block"),
			editorCallback: (editor) => {
				TemplateCommands.toggleCodeBlock(editor);
			},
		});

		// Phase 3: Frontmatter commands
		this.addCommand({
			id: "init-lonelog-note",
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
	}

	async activateView(viewType: string) {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(viewType)[0];

		if (!leaf) {
			// Create new leaf in right sidebar
			const rightLeaf = workspace.getRightLeaf(false);
			if (!rightLeaf) return;
			leaf = rightLeaf;
			await leaf.setViewState({
				type: viewType,
				active: true,
			});
		}

		// Reveal the leaf
		void workspace.revealLeaf(leaf);
	}
}
