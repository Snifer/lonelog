/**
 * Lonelog Dashboard View
 * A unified, premium interface for managing all campaign elements in one place.
 */

import { ItemView, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { NotationParser, ParsedElements } from "../utils/parser";
import { t } from "../i18n/i18n";
import LonelogPlugin from "../main";

export const DASHBOARD_VIEW_TYPE = "lonelog-dashboard";

export class DashboardView extends ItemView {
	private currentFile: TFile | null = null;
	private elements: ParsedElements | null = null;
	private plugin: LonelogPlugin;

	// Debounced refresh to save performance during rapid editing
	private debouncedRefresh = debounce(() => this.refresh(), 500, true);

	constructor(leaf: WorkspaceLeaf, plugin: LonelogPlugin) {
		super(leaf);
		this.plugin = plugin;
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
			container.createDiv({
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
		const grid = container.createDiv({ cls: "ll-dashboard-grid" });

		// Left Column: Timeline
		const leftCol = grid.createDiv({ cls: "ll-dashboard-col ll-timeline-col" });
		this.renderTimeline(leftCol);

		// Right Column: Elements & Progress
		const rightCol = grid.createDiv({ cls: "ll-dashboard-col ll-data-col" });
		
		// Progress Section
		this.renderProgress(rightCol);

		// Dungeon Section
		this.renderDungeon(rightCol);

		// Resources Section
		this.renderResources(rightCol);
		
		// Entities Section (NPCs, Locations, Threads)
		this.renderEntities(rightCol);
	}

	private renderHeader(container: HTMLElement, filename: string): void {
		const header = container.createDiv({ cls: "ll-dashboard-header" });
		const titleRow = header.createDiv({ cls: "ll-header-title-row" });
		titleRow.createEl("h1", { text: filename });
		
		const stats = header.createDiv({ cls: "ll-header-stats" });
		
		const totalScenes = this.elements?.sessions.reduce((acc, s) => acc + s.scenes.length, 0) || 0;
		
		this.createStatCard(stats, "Sessions", (this.elements?.sessions.length || 0).toString());
		this.createStatCard(stats, "Scenes", totalScenes.toString());
		this.createStatCard(stats, "NPCs", (this.elements?.npcs.size || 0).toString());
		this.createStatCard(stats, "Threads", (this.elements?.threads.size || 0).toString());
		this.createStatCard(stats, "Rooms", (this.elements?.rooms.size || 0).toString());
	}

	private createStatCard(container: HTMLElement, label: string, value: string): void {
		const card = container.createDiv({ cls: "ll-stat-card" });
		card.createSpan({ text: value, cls: "ll-stat-value" });
		card.createSpan({ text: label, cls: "ll-stat-label" });
	}

	private renderTimeline(container: HTMLElement): void {
		const section = container.createDiv({ cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.scene-nav-header") });

		if (!this.elements || this.elements.sessions.length === 0) {
			section.createDiv({ text: t("views.no-sessions"), cls: "ll-empty-hint" });
			return;
		}

		const timeline = section.createDiv({ cls: "ll-timeline-list" });
		
		this.elements.sessions.slice().reverse().forEach(session => {
			const sessionEl = timeline.createDiv({ cls: "ll-timeline-session" });
			const sHeader = sessionEl.createDiv({ cls: "ll-timeline-session-header" });
			
			sHeader.createSpan({ text: `Session ${session.number}`, cls: "ll-session-num" });
			if (session.date) sHeader.createSpan({ text: session.date, cls: "ll-session-date" });
			
			sHeader.addEventListener("click", () => this.jumpToLine(session.line));

			const scenesList = sessionEl.createDiv({ cls: "ll-timeline-scenes" });
			session.scenes.forEach(scene => {
				const sceneEl = scenesList.createDiv({ cls: "ll-timeline-scene-item" });
				sceneEl.createSpan({ text: scene.number, cls: "ll-scene-num-badge" });
				sceneEl.createSpan({ text: scene.context, cls: "ll-scene-context-text" });
				
				sceneEl.addEventListener("click", () => this.jumpToLine(scene.line));
			});
		});
	}

	private renderProgress(container: HTMLElement): void {
		const section = container.createDiv({ cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.progress-header") });

		if (!this.elements || this.elements.progress.length === 0) {
			section.createDiv({ text: t("views.no-progress"), cls: "ll-empty-hint" });
			return;
		}

		const grid = section.createDiv({ cls: "ll-progress-grid" });

		this.elements.progress.forEach(item => {
			const card = grid.createDiv({ cls: `ll-progress-card ll-type-${item.type}` });
			card.createDiv({ text: item.name, cls: "ll-progress-name" });
			
			if (item.max) {
				const barContainer = card.createDiv({ cls: "ll-progress-bar-container" });
				const percentage = Math.min(100, (item.current / item.max) * 100);
				barContainer.createDiv({ 
					cls: "ll-progress-bar-fill", 
					attr: { style: `width: ${percentage}%` } 
				});
				card.createDiv({ text: `${item.current} / ${item.max}`, cls: "ll-progress-value" });
			} else {
				card.createDiv({ text: item.current.toString(), cls: "ll-progress-value-large" });
			}
			
			card.addEventListener("click", () => this.jumpToLine(item.line));
		});
	}

	private renderDungeon(container: HTMLElement): void {
		if (!this.plugin.settings.enableDungeonAddon) return;
		const section = container.createDiv({ cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.dungeon-header") });

		if (!this.elements || this.elements.rooms.size === 0) {
			section.createDiv({ text: t("views.no-rooms"), cls: "ll-empty-hint" });
			return;
		}

		const list = section.createDiv({ cls: "ll-entity-list" });
		
		this.elements.rooms.forEach(room => {
			const item = list.createDiv({ cls: "ll-entity-item" });
			const nameCol = item.createDiv({ cls: "ll-room-info" });
			nameCol.createSpan({ text: `R${room.id}`, cls: "ll-entity-name" });
			if (room.description) {
				nameCol.createSpan({ text: room.description, cls: "ll-room-desc" });
			}
			
			const statusTags = item.createDiv({ cls: "ll-room-statuses" });
			room.status.forEach(s => {
				statusTags.createSpan({ 
					text: s, 
					cls: `ll-room-status ll-status-${s.toLowerCase().replace(/\s+/g, "-")}` 
				});
			});
			
			if (room.exits.length > 0) {
				const exitsEl = item.createDiv({ cls: "ll-room-exits" });
				exitsEl.createSpan({ text: "Exits: ", cls: "ll-exits-label" });
				exitsEl.createSpan({ text: room.exits.join(", "), cls: "ll-exits-list" });
			}

			item.addEventListener("click", () => this.jumpToLine(room.lastMention));
		});
	}

	private renderResources(container: HTMLElement): void {
		if (!this.plugin.settings.enableResourceAddon) return;
		if (!this.elements) return;
		
		const hasWealth = this.elements.wealth.size > 0;
		const hasInv = this.elements.inventory.size > 0;
		
		if (!hasWealth && !hasInv) return;

		const section = container.createDiv({ cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.resources-header") });

		// Render Wealth
		if (hasWealth) {
			const wealthContainer = section.createDiv({ cls: "ll-wealth-container" });
			this.elements.wealth.forEach((value, currency) => {
				const item = wealthContainer.createDiv({ cls: "ll-wealth-item" });
				item.createSpan({ text: currency, cls: "ll-wealth-label" });
				item.createSpan({ text: value, cls: "ll-wealth-value" });
			});
		}

		// Render Inventory
		if (hasInv) {
			const grid = section.createDiv({ cls: "ll-resource-grid" });
			this.elements.inventory.forEach(item => {
				const card = grid.createDiv({ cls: "ll-resource-card" });
				
				const main = card.createDiv({ cls: "ll-resource-main" });
				const info = main.createDiv({ cls: "ll-resource-info" });
				info.createDiv({ text: item.name, cls: "ll-resource-name" });
				
				if (item.properties.length > 0) {
					const propsEl = info.createDiv({ cls: "ll-resource-props" });
					item.properties.forEach(p => propsEl.createSpan({ text: p }));
				}
				
				if (item.quantity) {
					const qtyEl = main.createDiv({ cls: "ll-resource-qty" });
					qtyEl.setText(item.quantity);
				}

				card.addEventListener("click", () => this.jumpToLine(item.lastMention));
			});
		}
	}

	private renderEntities(container: HTMLElement): void {
		const section = container.createDiv({ cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.story-header") });

		const tabs = section.createDiv({ cls: "ll-entities-container" });
		
		// Threads
		if (this.elements?.threads.size) {
			const sub = tabs.createDiv({ cls: "ll-entity-group" });
			sub.createEl("h3", { text: t("views.threads") });
			const list = sub.createDiv({ cls: "ll-entity-list" });
			this.elements.threads.forEach(thread => {
				const item = list.createDiv({ cls: "ll-entity-item" });
				item.createSpan({ text: thread.name, cls: "ll-entity-name" });
				item.createSpan({ text: thread.state, cls: `ll-thread-status ll-status-${thread.state.toLowerCase()}` });
				item.addEventListener("click", () => this.jumpToLine(thread.lastMention));
			});
		}

		// NPCs
		if (this.elements?.npcs.size) {
			const sub = tabs.createDiv({ cls: "ll-entity-group" });
			sub.createEl("h3", { text: t("views.npcs") });
			const list = sub.createDiv({ cls: "ll-entity-gallery" });
			this.elements.npcs.forEach(npc => {
				const item = list.createDiv({ cls: "ll-entity-card" });
				item.createDiv({ text: npc.name, cls: "ll-entity-name-bold" });
				const tags = item.createDiv({ cls: "ll-entity-tags" });
				npc.tags.forEach(tag => tags.createSpan({ text: tag, cls: "ll-tag-badge" }));
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
