import { ItemView, WorkspaceLeaf } from "obsidian";
import { NotationParser, ParsedCombatEncounter, ParsedCombatant } from "../utils/parser";
import { t } from "../i18n/i18n";
import { Campaign, loadCampaign, openCampaignLine, registerCampaignRefresh } from "../utils/campaign-context";
import LonelogPlugin from "../main";

export const COMBAT_VIEW_TYPE = "lonelog-combat-view";

export class CombatTrackerView extends ItemView {
	private campaign: Campaign | null = null;
	private lastRefreshId: number = 0;
	private plugin: LonelogPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: LonelogPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return COMBAT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.combat-tracker-title");
	}

	getIcon(): string {
		return "swords"; // Lucide icon for combat
	}

	async onOpen() {
		await super.onOpen();
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.refresh())
		);
		registerCampaignRefresh(this, this.app, () => this.campaign, () => this.refresh());

		this.refresh();
	}

	private refresh() {
		const refreshId = ++this.lastRefreshId;
		const activeFile = this.app.workspace.getActiveFile();
		const container = this.contentEl;
		container.empty();

		if (!activeFile || activeFile.extension !== "md") {
			container.createDiv({
				text: t("views.no-active-file"),
				cls: "lonelog-empty-state",
			});
			return;
		}

		// Read the campaign notes from the vault since the active leaf might not be an editor
		void loadCampaign(this.app, activeFile, this.plugin.settings.campaignScope).then((campaign) => {
			// If a new refresh has started, don't proceed with this one
			if (refreshId !== this.lastRefreshId) return;

			this.campaign = campaign;
			const elements = NotationParser.parse(campaign.content);
			
			if (elements.combat.length === 0) {
				this.contentEl.createDiv({
					text: t("views.no-combat-encounters"),
					cls: "lonelog-empty-state",
				});
				return;
			}

			// Focus on the last active encounter
			const activeEncounter = elements.combat[elements.combat.length - 1];
			if (activeEncounter) {
				this.renderEncounter(this.contentEl, activeEncounter);
			}
		});
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
				void openCampaignLine(this.app, this.campaign, c.line);
			});

			const statsRow = item.createDiv({ cls: "lonelog-combatant-stats" });
			c.stats.forEach((stat: string) => {
				statsRow.createSpan({ text: stat, cls: "lonelog-stat-tag" });
			});
		});
	}
}
