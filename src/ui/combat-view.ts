import { NotationParser, ParsedCombatEncounter, ParsedCombatant } from "../utils/parser";
import { t } from "../i18n/i18n";
import { Campaign } from "../utils/campaign-context";
import { LonelogView } from "./lonelog-view";

export const COMBAT_VIEW_TYPE = "lonelog-combat-view";

export class CombatTrackerView extends LonelogView {
	getViewType(): string {
		return COMBAT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.combat-tracker-title");
	}

	getIcon(): string {
		return "swords"; // Lucide icon for combat
	}

	protected renderCampaign(container: HTMLElement, campaign: Campaign): void {
		const elements = NotationParser.parse(campaign.content);

		if (elements.combat.length === 0) {
			container.createDiv({
				text: t("views.no-combat-encounters"),
				cls: "lonelog-empty-state",
			});
			return;
		}

		// Focus on the last active encounter
		const activeEncounter = elements.combat[elements.combat.length - 1];
		if (activeEncounter) {
			this.renderEncounter(container, activeEncounter);
		}
	}

	private renderEncounter(
		container: Element,
		encounter: ParsedCombatEncounter
	) {
		const combatContainer = container.createDiv({
			cls: "lonelog-combat-container",
		});

		// Header
		const header = combatContainer.createDiv({
			cls: "lonelog-combat-header",
		});
		
		const titleRow = header.createDiv({ cls: "lonelog-combat-title-row" });
		titleRow.createEl("h4", { text: t("views.active-combat") });
		
		if (encounter.isClosed) {
			titleRow.createSpan({ 
				text: t("views.combat-finished"), 
				cls: "lonelog-combat-status-finished" 
			});
		}

		const roundInfo = header.createDiv({ cls: "lonelog-combat-round-info" });
		roundInfo.createSpan({ 
			text: `${t("views.round")} ${encounter.currentRound}`,
			cls: "lonelog-round-badge"
		});

		// Combatant List
		const roster = combatContainer.createDiv({
			cls: "lonelog-combat-list",
		});

		// Separate PCs and Foes
		const combatants = Array.from(encounter.combatants.values());
		const pcs = combatants.filter(c => c.type === "pc" || c.type === "ally");
		const foes = combatants.filter(c => c.type === "foe");

		if (pcs.length > 0) {
			this.renderSection(roster, t("views.party"), pcs);
		}

		if (foes.length > 0) {
			this.renderSection(roster, t("views.foes"), foes);
		}
	}

	private renderSection(
		parent: Element,
		title: string,
		list: ParsedCombatant[]
	) {
		const section = parent.createDiv({ cls: "lonelog-combat-section" });
		section.createEl("h5", { text: title });

		const listContainer = section.createDiv({ cls: "lonelog-combatant-list" });

		list.forEach(c => {
			const item = listContainer.createDiv({ 
				cls: `lonelog-combatant-card lonelog-combatant-${c.type}` 
			});

			const nameRow = item.createDiv({ cls: "lonelog-combatant-name-row" });
			const nameBtn = nameRow.createEl("button", {
				text: c.name,
				cls: "lonelog-combatant-name"
			});
			
			nameBtn.onClickEvent(() => {
				this.jumpToLine(c.line);
			});

			const statsRow = item.createDiv({ cls: "lonelog-combatant-stats" });
			c.stats.forEach((stat: string) => {
				statsRow.createSpan({ text: stat, cls: "lonelog-stat-tag" });
			});
		});
	}
}
