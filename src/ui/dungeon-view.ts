/**
 * Lonelog Dungeon View
 * A dedicated sidebar view for tracking rooms and dungeon exploration.
 */

import { Campaign } from "../utils/campaign-context";
import { LonelogView } from "./lonelog-view";
import { NotationParser, ParsedElements } from "../utils/parser";
import { t } from "../i18n/i18n";

export const DUNGEON_VIEW_TYPE = "lonelog-dungeon-view";

export class DungeonStatusView extends LonelogView {
	private elements: ParsedElements | null = null;

	// Reuse the same premium sidebar padding/styles
	protected readonly containerClasses = ["lonelog-thread-container"];

	getViewType(): string {
		return DUNGEON_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.dungeon-title");
	}

	getIcon(): string {
		return "map";
	}

	protected renderCampaign(container: HTMLElement, campaign: Campaign): void {
		this.elements = NotationParser.parse(campaign.content);

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
				text: room.id, 
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
}
