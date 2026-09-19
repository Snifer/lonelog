/**
 * Lonelog Dungeon View
 * A dedicated sidebar view for tracking rooms and dungeon exploration.
 */

import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { NotationParser, ParsedElements } from "../utils/parser";
import { t } from "../i18n/i18n";

export const DUNGEON_VIEW_TYPE = "lonelog-dungeon-view";

export class DungeonStatusView extends ItemView {
	private elements: ParsedElements | null = null;
	private currentFile: TFile | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return DUNGEON_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.dungeon-title");
	}

	getIcon(): string {
		return "map";
	}

	async onOpen(): Promise<void> {
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => void this.refresh()));
		this.registerEvent(this.app.vault.on("modify", (file) => {
			if (file === this.currentFile) void this.refresh();
		}));
		
		await this.refresh();
	}

	async refresh(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass("lonelog-thread-container"); // Reuse the same premium sidebar padding/styles

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

		const header = container.createDiv({ cls: "lonelog-thread-header" });
		header.createEl("h4", { text: t("views.dungeon-header") });

		if (!this.elements || this.elements.rooms.size === 0) {
			container.createDiv({
				text: t("views.no-rooms"),
				cls: "lonelog-empty-state",
			});
			return;
		}

		const list = container.createDiv({ cls: "lonelog-thread-list" });

		this.elements.rooms.forEach(room => {
			const item = list.createDiv({ cls: "lonelog-thread-item" });
			
			const nameRow = item.createDiv({ cls: "lonelog-thread-item-name-row" });
			const nameBtn = nameRow.createEl("button", { 
				text: `R${room.id}`, 
				cls: "lonelog-thread-item-name" 
			});
			nameBtn.addEventListener("click", () => this.jumpToLine(room.lastMention));

			if (room.description) {
				item.createDiv({ 
					text: room.description, 
					cls: "lonelog-thread-item-tags", // Reuse description style
					attr: { style: "font-style: italic; margin-bottom: 4px;" }
				});
			}

			const statusRow = item.createDiv({ cls: "ll-room-statuses" });
			room.status.forEach(s => {
				statusRow.createSpan({ 
					text: s, 
					cls: `ll-room-status ll-status-${s.toLowerCase().replace(/\s+/g, "-")}` 
				});
			});

			if (room.exits.length > 0) {
				const exitsEl = item.createDiv({ cls: "ll-room-exits" });
				exitsEl.createSpan({ text: "Exits: ", cls: "ll-exits-label" });
				exitsEl.createSpan({ text: room.exits.join(", "), cls: "ll-exits-list" });
			}
		});
	}

	private jumpToLine(line: number): void {
		if (!this.currentFile) return;

		const leaf = this.app.workspace.getLeaf(false);
		void leaf.openFile(this.currentFile).then(() => {
			const editor = this.app.workspace.activeEditor?.editor;
			if (editor) {
				editor.setCursor({ line, ch: 0 });
				editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
			}
		});
	}
}
