/**
 * Lonelog Resource Status View
 * A dedicated sidebar view for tracking items, supplies, and wealth.
 */

import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { NotationParser, ParsedElements, ParsedItem } from "../utils/parser";
import { t } from "../i18n/i18n";

export const RESOURCE_VIEW_TYPE = "lonelog-resource-view";

export class ResourceStatusView extends ItemView {
	private elements: ParsedElements | null = null;
	private currentFile: TFile | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return RESOURCE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.resources-header");
	}

	getIcon(): string {
		return "coins";
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
		container.addClass("lonelog-dashboard-container");

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

		const header = container.createEl("div", { cls: "ll-dashboard-header", attr: { style: "padding: 0 10px;" } });
		header.createEl("h3", { text: t("views.resources-header") });

		if (!this.elements || (this.elements.inventory.size === 0 && this.elements.wealth.size === 0)) {
			container.createEl("div", {
				text: t("views.no-resources"),
				cls: "lonelog-empty-state",
			});
			return;
		}

		// Wealth Summary
		if (this.elements.wealth.size > 0) {
			const wealthCard = container.createEl("div", { cls: "ll-wealth-container" });
			this.elements.wealth.forEach((value, currency) => {
				const item = wealthCard.createEl("div", { cls: "ll-wealth-item" });
				item.createEl("span", { text: currency, cls: "ll-wealth-label" });
				item.createEl("span", { text: value, cls: "ll-wealth-value" });
			});
		}

		const grid = container.createEl("div", { cls: "ll-resource-grid", attr: { style: "padding: 0 10px;" } });

		const slots    = new Map<string, ParsedItem>();
		const children = new Map<string, ParsedItem[]>();
		const loose    = new Map<string, ParsedItem>();

		this.elements.inventory.forEach(item => {
		    if (item.isContainer) {
		        slots.set(item.name, item);
		    } else if (item.slotParent) {
		        const list = children.get(item.slotParent) ?? [];
		        list.push(item);
		        children.set(item.slotParent, list);
		    } else {
		        loose.set(item.name, item);
		    }
		});

		loose.forEach(item => this.renderItemCard(grid, item));

		slots.forEach((slot, slotName) => {
		    const kids = children.get(slotName) ?? [];
		    const slotSection = grid.createEl("div", { cls: "ll-slot-section" });
		    const slotHeader = slotSection.createEl("div", { cls: "ll-slot-header" });
		    slotHeader.createEl("span", { text: slotName, cls: "ll-slot-name" });
		    slotHeader.addEventListener("click", () => this.jumpToLine(slot.lastMention));
		    if (kids.length === 0) {
		        slotSection.createEl("div", { text: "—", cls: "ll-slot-empty" });
		    } else {
		        kids.forEach(child => this.renderItemCard(slotSection, child, true));
		    }
		});

		// Sub-items whose slot parent didn't appear as a container tag (defensive)
		children.forEach((kids, parentName) => {
		    if (slots.has(parentName)) return;
		    kids.forEach(child => this.renderItemCard(grid, child));
		});
	}

	private renderItemCard(container: HTMLElement, item: ParsedItem, isChild = false): void {
	    const card = container.createEl("div", {
	        cls: isChild ? "ll-resource-card ll-resource-child" : "ll-resource-card"
	    });
	    const main = card.createEl("div", { cls: "ll-resource-main" });
	    const info = main.createEl("div", { cls: "ll-resource-info" });
	    const nameBtn = info.createEl("div", { text: item.name, cls: "ll-resource-name" });
	    nameBtn.addClass("is-clickable");
	    nameBtn.addEventListener("click", () => this.jumpToLine(item.lastMention));
	    if (item.properties.length > 0) {
	        const propsEl = info.createEl("div", { cls: "ll-resource-props" });
	        item.properties.forEach(p => propsEl.createEl("span", { text: p }));
	    }
	    if (item.quantity) {
	        const qtyEl = main.createEl("div", { cls: "ll-resource-qty" });
	        qtyEl.setText(item.quantity);
	    }
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
