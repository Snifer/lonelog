/**
 * Lonelog Resource Status View
 * A dedicated sidebar view for tracking items, supplies, and wealth.
 */

import { Campaign } from "../utils/campaign-context";
import { LonelogView } from "./lonelog-view";
import { NotationParser, ParsedElements, ParsedItem } from "../utils/parser";
import { t } from "../i18n/i18n";

export const RESOURCE_VIEW_TYPE = "lonelog-resource-view";

export class ResourceStatusView extends LonelogView {
	private elements: ParsedElements | null = null;

	protected readonly containerClasses = ["lonelog-dashboard-container"];

	getViewType(): string {
		return RESOURCE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.resources-header");
	}

	getIcon(): string {
		return "coins";
	}

	protected renderCampaign(container: HTMLElement, campaign: Campaign): void {
		this.elements = NotationParser.parse(campaign.content);

		const header = container.createDiv({ cls: "ll-dashboard-header", attr: { style: "padding: 0 10px;" } });
		header.createEl("h3", { text: t("views.resources-header") });

		if (!this.elements || (this.elements.inventory.size === 0 && this.elements.wealth.size === 0)) {
			container.createDiv({
				text: t("views.no-resources"),
				cls: "lonelog-empty-state",
			});
			return;
		}

		// Wealth Summary
		if (this.elements.wealth.size > 0) {
			const wealthCard = container.createDiv({ cls: "ll-wealth-container" });
			this.elements.wealth.forEach((value, currency) => {
				const item = wealthCard.createDiv({ cls: "ll-wealth-item" });
				item.createSpan({ text: currency, cls: "ll-wealth-label" });
				item.createSpan({ text: value, cls: "ll-wealth-value" });
			});
		}

		const grid = container.createDiv({ cls: "ll-resource-grid", attr: { style: "padding: 0 10px;" } });

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
		    const slotSection = grid.createDiv({ cls: "ll-slot-section" });
		    const slotHeader = slotSection.createDiv({ cls: "ll-slot-header" });
		    slotHeader.createSpan({ text: slotName, cls: "ll-slot-name" });
		    slotHeader.addEventListener("click", () => this.jumpToLine(slot.lastMention));
		    if (kids.length === 0) {
		        slotSection.createDiv({ text: "—", cls: "ll-slot-empty" });
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
	    const card = container.createDiv({
	        cls: isChild ? "ll-resource-card ll-resource-child" : "ll-resource-card"
	    });
	    const main = card.createDiv({ cls: "ll-resource-main" });
	    const info = main.createDiv({ cls: "ll-resource-info" });
	    const nameBtn = info.createDiv({ text: item.name, cls: "ll-resource-name" });
	    nameBtn.addClass("is-clickable");
	    nameBtn.addEventListener("click", () => this.jumpToLine(item.lastMention));
	    if (item.properties.length > 0) {
	        const propsEl = info.createDiv({ cls: "ll-resource-props" });
	        item.properties.forEach(p => propsEl.createSpan({ text: p }));
	    }
	    if (item.quantity) {
	        const qtyEl = main.createDiv({ cls: "ll-resource-qty" });
	        qtyEl.setText(item.quantity);
	    }
	}
}
