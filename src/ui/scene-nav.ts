/**
 * Scene Navigator Panel
 * Displays an outline of all sessions and scenes for easy navigation
 */

import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { NotationParser, ParsedSession, ParsedScene } from "../utils/parser";

export const SCENE_NAV_TYPE = "lonelog-scene-nav";

export class SceneNavigatorView extends ItemView {
	private sessions: ParsedSession[] = [];
	private currentFile: TFile | null = null;
	private lastRefreshId: number = 0;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return SCENE_NAV_TYPE;
	}

	getDisplayText(): string {
		return "Lonelog scenes";
	}

	getIcon(): string {
		return "map";
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("lonelog-scene-container");

		// Listen for active file changes
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				void this.refresh();
			})
		);

		// Listen for file modifications
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file === this.currentFile) {
					void this.refresh();
				}
			})
		);

		void this.refresh();
		return Promise.resolve();
	}

	async refresh(): Promise<void> {
		const refreshId = ++this.lastRefreshId;
		const container = this.contentEl;
		container.empty();

		// Get active file
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			container.createEl("div", {
				text: "No active file",
				cls: "lonelog-empty-state",
			});
			return;
		}

		this.currentFile = activeFile;

		// Read and parse file
		const content = await this.app.vault.read(activeFile);
		
		// If a new refresh has started, don't proceed with this one
		if (refreshId !== this.lastRefreshId) return;

		const parsed = NotationParser.parse(content);
		this.sessions = parsed.sessions;

		// Render header
		const header = container.createEl("div", {
			cls: "lonelog-scene-header",
		});
		header.createEl("h4", { text: "Scene navigator" });

		const totalScenes = this.sessions.reduce(
			(sum, session) => sum + session.scenes.length,
			0
		);
		header.createEl("span", {
			text: `${this.sessions.length} sessions, ${totalScenes} scenes`,
			cls: "lonelog-count",
		});

		// Check if empty
		if (this.sessions.length === 0) {
			container.createEl("div", {
				text: "No sessions found. Use 'insert session header' to create one.",
				cls: "lonelog-empty-state",
			});
			return;
		}

		// Render sessions
		this.sessions.forEach((session) => {
			this.renderSession(container, session);
		});
	}

	private renderSession(container: HTMLElement, session: ParsedSession): void {
		const sessionEl = container.createEl("div", {
			cls: "lonelog-scene-session",
		});

		// Session header (clickable)
		const sessionHeader = sessionEl.createEl("div", {
			cls: "lonelog-scene-session-header",
		});

		const sessionBtn = sessionHeader.createEl("button", {
			cls: "lonelog-scene-session-btn",
		});

		const sessionTitle = sessionBtn.createEl("span", {
			cls: "lonelog-scene-session-title",
		});
		sessionTitle.createEl("strong", { text: `Session ${session.number}` });

		if (session.date) {
			sessionTitle.createEl("span", {
				text: ` • ${session.date}`,
				cls: "lonelog-scene-date",
			});
		}

		sessionBtn.addEventListener("click", () => {
			this.jumpToLine(session.line);
		});

		// Scene count
		sessionHeader.createEl("span", {
			text: `${session.scenes.length} scenes`,
			cls: "lonelog-scene-count",
		});

		// Scenes list
		if (session.scenes.length > 0) {
			const scenesList = sessionEl.createEl("div", {
				cls: "lonelog-scene-list",
			});

			session.scenes.forEach((scene) => {
				this.renderScene(scenesList, scene);
			});
		} else {
			sessionEl.createEl("div", {
				text: "No scenes yet",
				cls: "lonelog-scene-empty",
			});
		}
	}

	private renderScene(container: HTMLElement, scene: ParsedScene): void {
		const sceneEl = container.createEl("div", {
			cls: "lonelog-scene-item",
		});

		const sceneBtn = sceneEl.createEl("button", {
			cls: "lonelog-scene-btn",
		});

		sceneBtn.createEl("span", {
			text: scene.number,
			cls: "lonelog-scene-number",
		});

		sceneBtn.createEl("span", {
			text: scene.context,
			cls: "lonelog-scene-context",
		});

		sceneBtn.addEventListener("click", () => {
			this.jumpToLine(scene.line);
		});
	}

	private jumpToLine(line: number): void {
		if (!this.currentFile) return;

		const leaf = this.app.workspace.getLeaf(false);
		void leaf.openFile(this.currentFile).then(() => {
			const editor = this.app.workspace.activeEditor?.editor;
			if (editor) {
				editor.setCursor({ line, ch: 0 });
				editor.scrollIntoView(
					{ from: { line, ch: 0 }, to: { line, ch: 0 } },
					true
				);
			}
		});
	}

	async onClose(): Promise<void> {
		// Cleanup
	}
}
