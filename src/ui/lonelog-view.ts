/**
 * Lonelog View
 * Base class of the Lonelog sidebar panels and dashboards that show the active campaign.
 * It loads the campaign (one or more files, depending on the campaign scope setting),
 * keeps it up to date, and leaves parsing and rendering to the individual views.
 */

import { App, ItemView, WorkspaceLeaf, debounce } from "obsidian";
import { t } from "../i18n/i18n";
import { Campaign, loadCampaign, openCampaignLine, registerCampaignRefresh } from "../utils/campaign";
import type LonelogPlugin from "../main";

export abstract class LonelogView extends ItemView {
	/** The campaign that is currently shown, `null` until it was loaded the first time */
	protected campaign: Campaign | null = null;
	private lastRefreshId: number = 0;

	/** CSS classes to add to the view's content element */
	protected readonly containerClasses: string[] = [];

	/** Delay before refreshing when opened and when the active leaf changes, 0 to refresh right away */
	protected readonly refreshDelayMs: number = 0;

	constructor(leaf: WorkspaceLeaf, protected readonly plugin: LonelogPlugin) {
		super(leaf);
		// A static panel, so opening a note from it must never replace the panel itself
		this.navigation = false;
	}

	/**
	 * Parse and render the loaded campaign into the container, which is already emptied
	 */
	protected abstract renderCampaign(container: HTMLElement, campaign: Campaign): void;

	/**
	 * Render a message and return `true` if the view can't show a campaign right now,
	 * e.g. because the add-on it belongs to is disabled.
	 */
	protected renderBlocked(container: HTMLElement): boolean {
		return false;
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass(...this.containerClasses);

		let scheduleRefresh = (): void => {
			void this.refresh();
		};
		if (this.refreshDelayMs > 0) {
			// Debounced to save performance during rapid editing
			const debounced = debounce(scheduleRefresh, this.refreshDelayMs, true);
			this.register(() => debounced.cancel());
			scheduleRefresh = debounced;
		}

		// Listen for active file changes
		this.registerEvent(this.app.workspace.on("active-leaf-change", scheduleRefresh));

		// Listen for file modifications
		registerCampaignRefresh(this, this.app, () => this.campaign, () => void this.refresh());

		scheduleRefresh();
		return Promise.resolve();
	}

	async refresh(): Promise<void> {
		const refreshId = ++this.lastRefreshId;
		const container = this.contentEl;
		container.empty();

		if (this.renderBlocked(container)) return;

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			container.createDiv({
				text: t("views.no-active-file"),
				cls: "lonelog-empty-state",
			});
			return;
		}

		let campaign: Campaign;
		try {
			campaign = await loadCampaign(this.app, activeFile, this.plugin.settings.campaignScope);
		} catch (error) {
			console.error("Error reading campaign files:", error);
			if (refreshId === this.lastRefreshId) {
				container.createDiv({
					text: t("views.load-failed"),
					cls: "lonelog-empty-state",
				});
			}
			return;
		}

		// If a new refresh has started, don't proceed with this one
		if (refreshId !== this.lastRefreshId) return;

		this.campaign = campaign;
		this.renderCampaign(container, campaign);
	}

	/**
	 * Open the file and line of the campaign that the given line of the combined campaign content belongs to
	 */
	protected jumpToLine(line: number): void {
		void openCampaignLine(this.app, this.campaign, line);
	}
}

/**
 * Re-render all open Lonelog views, e.g. after the campaign scope setting changed
 */
export function refreshViews(app: App): void {
	app.workspace.iterateAllLeaves((leaf) => {
		if (leaf.view instanceof LonelogView) {
			void leaf.view.refresh();
		}
	});
}
