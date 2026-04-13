/**
 * Lonelog Dashboard View
 * A unified, premium interface for managing all campaign elements in one place.
 */

import { ItemView, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { NotationParser, ParsedElements, ParsedSession, ParsedScene } from "../utils/parser";
import { t } from "../i18n/i18n";

export const DASHBOARD_VIEW_TYPE = "lonelog-dashboard";

export class DashboardView extends ItemView {
	private currentFile: TFile | null = null;
	private elements: ParsedElements | null = null;

	// Debounced refresh to save performance during rapid editing
	private debouncedRefresh = debounce(() => this.refresh(), 500, true);

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.dashboard-title");
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("lonelog-dashboard-container");

		// Listen for active file changes
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.debouncedRefresh();
			})
		);

		// Listen for file modifications
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file === this.currentFile) {
					this.debouncedRefresh();
				}
			})
		);

		this.debouncedRefresh();
		return Promise.resolve();
	}

	async refresh(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			container.createEl("div", {
				text: t("views.no-active-file"),
				cls: "lonelog-empty-state",
			});
			return;
		}

		this.currentFile = activeFile;
		const content = await this.app.vault.read(activeFile);
		this.elements = NotationParser.parse(content);

		// --- HEADER ---
		this.renderHeader(container, activeFile.basename);

		// --- MAIN GRID ---
		const grid = container.createEl("div", { cls: "ll-dashboard-grid" });

		// Left Column: Timeline
		const leftCol = grid.createEl("div", { cls: "ll-dashboard-col ll-timeline-col" });
		this.renderTimeline(leftCol);

		// Right Column: Elements & Progress
		const rightCol = grid.createEl("div", { cls: "ll-dashboard-col ll-data-col" });
		
		// Progress Section
		this.renderProgress(rightCol);
		
		// Entities Section (NPCs, Locations, Threads)
		this.renderEntities(rightCol);
	}

	private renderHeader(container: HTMLElement, filename: string): void {
		const header = container.createEl("div", { cls: "ll-dashboard-header" });
		const titleRow = header.createEl("div", { cls: "ll-header-title-row" });
		titleRow.createEl("h1", { text: filename });
		
		const stats = header.createEl("div", { cls: "ll-header-stats" });
		
		const totalScenes = this.elements?.sessions.reduce((acc, s) => acc + s.scenes.length, 0) || 0;
		
		this.createStatCard(stats, "Sessions", (this.elements?.sessions.length || 0).toString());
		this.createStatCard(stats, "Scenes", totalScenes.toString());
		this.createStatCard(stats, "NPCs", (this.elements?.npcs.size || 0).toString());
		this.createStatCard(stats, "Threads", (this.elements?.threads.size || 0).toString());
	}

	private createStatCard(container: HTMLElement, label: string, value: string): void {
		const card = container.createEl("div", { cls: "ll-stat-card" });
		card.createEl("span", { text: value, cls: "ll-stat-value" });
		card.createEl("span", { text: label, cls: "ll-stat-label" });
	}

	private renderTimeline(container: HTMLElement): void {
		const section = container.createEl("div", { cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.scene-nav-header") });

		if (!this.elements || this.elements.sessions.length === 0) {
			section.createEl("div", { text: t("views.no-sessions"), cls: "ll-empty-hint" });
			return;
		}

		const timeline = section.createEl("div", { cls: "ll-timeline-list" });
		
		this.elements.sessions.slice().reverse().forEach(session => {
			const sessionEl = timeline.createEl("div", { cls: "ll-timeline-session" });
			const sHeader = sessionEl.createEl("div", { cls: "ll-timeline-session-header" });
			
			sHeader.createEl("span", { text: `Session ${session.number}`, cls: "ll-session-num" });
			if (session.date) sHeader.createEl("span", { text: session.date, cls: "ll-session-date" });
			
			sHeader.addEventListener("click", () => this.jumpToLine(session.line));

			const scenesList = sessionEl.createEl("div", { cls: "ll-timeline-scenes" });
			session.scenes.forEach(scene => {
				const sceneEl = scenesList.createEl("div", { cls: "ll-timeline-scene-item" });
				sceneEl.createEl("span", { text: scene.number, cls: "ll-scene-num-badge" });
				sceneEl.createEl("span", { text: scene.context, cls: "ll-scene-context-text" });
				
				sceneEl.addEventListener("click", () => this.jumpToLine(scene.line));
			});
		});
	}

	private renderProgress(container: HTMLElement): void {
		const section = container.createEl("div", { cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.progress-header") });

		if (!this.elements || this.elements.progress.length === 0) {
			section.createEl("div", { text: t("views.no-progress"), cls: "ll-empty-hint" });
			return;
		}

		const grid = section.createEl("div", { cls: "ll-progress-grid" });

		this.elements.progress.forEach(item => {
			const card = grid.createEl("div", { cls: `ll-progress-card ll-type-${item.type}` });
			card.createEl("div", { text: item.name, cls: "ll-progress-name" });
			
			if (item.max) {
				const barContainer = card.createEl("div", { cls: "ll-progress-bar-container" });
				const percentage = Math.min(100, (item.current / item.max) * 100);
				barContainer.createEl("div", { 
					cls: "ll-progress-bar-fill", 
					attr: { style: `width: ${percentage}%` } 
				});
				card.createEl("div", { text: `${item.current} / ${item.max}`, cls: "ll-progress-value" });
			} else {
				card.createEl("div", { text: item.current.toString(), cls: "ll-progress-value-large" });
			}
			
			card.addEventListener("click", () => this.jumpToLine(item.line));
		});
	}

	private renderEntities(container: HTMLElement): void {
		const section = container.createEl("div", { cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.story-header") });

		const tabs = section.createEl("div", { cls: "ll-entities-container" });
		
		// Threads
		if (this.elements?.threads.size) {
			const sub = tabs.createEl("div", { cls: "ll-entity-group" });
			sub.createEl("h3", { text: t("views.threads") });
			const list = sub.createEl("div", { cls: "ll-entity-list" });
			this.elements.threads.forEach(thread => {
				const item = list.createEl("div", { cls: "ll-entity-item" });
				item.createEl("span", { text: thread.name, cls: "ll-entity-name" });
				item.createEl("span", { text: thread.state, cls: `ll-thread-status ll-status-${thread.state.toLowerCase()}` });
				item.addEventListener("click", () => this.jumpToLine(thread.lastMention));
			});
		}

		// NPCs
		if (this.elements?.npcs.size) {
			const sub = tabs.createEl("div", { cls: "ll-entity-group" });
			sub.createEl("h3", { text: t("views.npcs") });
			const list = sub.createEl("div", { cls: "ll-entity-gallery" });
			this.elements.npcs.forEach(npc => {
				const item = list.createEl("div", { cls: "ll-entity-card" });
				item.createEl("div", { text: npc.name, cls: "ll-entity-name-bold" });
				const tags = item.createEl("div", { cls: "ll-entity-tags" });
				npc.tags.forEach(tag => tags.createEl("span", { text: tag, cls: "ll-tag-badge" }));
				item.addEventListener("click", () => this.jumpToLine(npc.lastMention));
			});
		}
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
		// Cleanup if needed
	}
}
