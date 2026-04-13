/**
 * Scene Navigator Panel
 * Displays an outline of all sessions and scenes for easy navigation
 */

import { ItemView, TFile, WorkspaceLeaf } from "obsidian";

export const SCENE_NAV_TYPE = "lonelog-scene-nav";

interface Session {
	number: number;
	title: string;
	line: number;
	date?: string;
	scenes: Scene[];
}

interface Scene {
	number: string;
	context: string;
	line: number;
}

export class SceneNavigatorView extends ItemView {
	private sessions: Session[] = [];
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

		this.sessions = this.parseSessions(content);

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

	private parseSessions(content: string): Session[] {
		const lines = content.split("\n");
		const sessions: Session[] = [];
		let currentSession: Session | null = null;

		lines.forEach((line, index) => {
			// Match session header: ## Session 1
			const sessionMatch = line.match(/^##\s+Session\s+(\d+)(.*)$/);
			if (sessionMatch && sessionMatch[1]) {
				if (currentSession) {
					sessions.push(currentSession);
				}

				const sessionNum = sessionMatch[1];
				const sessionExtra = sessionMatch[2] || '';
				
				currentSession = {
					number: parseInt(sessionNum),
					title: sessionExtra.trim() || `Session ${sessionNum}`,
					line: index,
					scenes: [],
				};

				// Try to extract date from next line
				if (index + 1 < lines.length) {
					const nextLine = lines[index + 1];
					if (nextLine) {
						const dateMatch = nextLine.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);
						if (dateMatch && dateMatch[1]) {
							currentSession.date = dateMatch[1];
						}
					}
				}
				return;
			}

			// Match scene marker: ### S1 *context*
			const sceneMatch = line.match(/^###\s+(S[\d.a-zA-Z-]+)\s*\*([^*]*)\*/);
			if (sceneMatch && sceneMatch[1] && currentSession) {
				currentSession.scenes.push({
					number: sceneMatch[1],
					context: sceneMatch[2]?.trim() || "Scene",
					line: index,
				});
				return;
			}

			// Also match simpler scene format: ### S1
			const simpleSceneMatch = line.match(/^###\s+(S[\d.a-zA-Z-]+)(?:\s+(.*))?$/);
			if (simpleSceneMatch && simpleSceneMatch[1] && currentSession && !sceneMatch) {
				const sceneNumber = simpleSceneMatch[1];
				currentSession.scenes.push({
					number: sceneNumber,
					context: simpleSceneMatch[2]?.trim() || "Scene",
					line: index,
				});
			}
		});

		// Don't forget the last session
		if (currentSession) {
			sessions.push(currentSession);
		}

		return sessions;
	}

	private renderSession(container: HTMLElement, session: Session): void {
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

	private renderScene(container: HTMLElement, scene: Scene): void {
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
