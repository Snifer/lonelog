import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { NotationParser, ParsedCombatEncounter, ParsedCombatant } from "../utils/parser";
import { t } from "../i18n/i18n";

export const COMBAT_VIEW_TYPE = "lonelog-combat-view";

export class CombatTrackerView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
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
			this.app.workspace.on("active-leaf-change", () => this.update())
		);
		this.registerEvent(this.app.vault.on("modify", () => this.update()));

		this.update();
	}

	private update() {
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

		// Use the vault to read file content since it might not be the active leaf's editor
		void this.app.vault.read(activeFile).then((content) => {
			const elements = NotationParser.parse(content);
			
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
				this.renderEncounter(this.contentEl, activeEncounter, activeFile);
			}
		});
	}

	private renderEncounter(
		container: Element,
		encounter: ParsedCombatEncounter,
		file: TFile
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
		const pcs = combatants.filter(c => c.type === "pc");
		const foes = combatants.filter(c => c.type === "foe");

		if (pcs.length > 0) {
			this.renderSection(roster, t("views.party"), pcs, file);
		}

		if (foes.length > 0) {
			this.renderSection(roster, t("views.foes"), foes, file);
		}
	}

	private renderSection(
		parent: Element,
		title: string,
		list: ParsedCombatant[],
		file: TFile
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
				void this.jumpToLine(file, c.line);
			});

			const statsRow = item.createDiv({ cls: "lonelog-combatant-stats" });
			c.stats.forEach((stat: string) => {
				statsRow.createSpan({ text: stat, cls: "lonelog-stat-tag" });
			});
		});
	}

	private async jumpToLine(file: TFile, line: number) {
		const leaf = this.app.workspace.getMostRecentLeaf();
		if (leaf) {
			await leaf.openFile(file, { eState: { line } });
		}
	}
}
