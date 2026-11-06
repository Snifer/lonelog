/**
 * Progress Tracker Panel
 * Displays and manages all progress elements (clocks, tracks, timers)
 */

import { NotationParser, ParsedProgress } from "../utils/parser";
import { Campaign } from "../utils/campaign-context";
import { resolveLine } from "../utils/campaign-content";
import { LonelogView } from "./lonelog-view";

export const PROGRESS_VIEW_TYPE = "lonelog-progress-view";

export class ProgressTrackerView extends LonelogView {
	private progressElements: ParsedProgress[] = [];

	protected readonly containerClasses = ["lonelog-progress-container"];

	getViewType(): string {
		return PROGRESS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Lonelog progress";
	}

	getIcon(): string {
		return "clock";
	}

	protected renderCampaign(container: HTMLElement, campaign: Campaign): void {
		const parsed = NotationParser.parse(campaign.content);
		this.progressElements = parsed.progress;

		// Render header
		const header = container.createDiv({
			cls: "lonelog-progress-header",
		});
		header.createEl("h4", { text: "Progress tracker" });
		header.createSpan({
			text: `${this.progressElements.length} items`,
			cls: "lonelog-count",
		});

		// Group by type
		const clocks = this.progressElements.filter((p) => p.type === "clock");
		const tracks = this.progressElements.filter((p) => p.type === "track");
		const timers = this.progressElements.filter((p) => p.type === "timer");

		if (this.progressElements.length === 0) {
			container.createDiv({
				text: "No progress elements found",
				cls: "lonelog-empty-state",
			});
			return;
		}

		// Render each type
		if (clocks.length > 0) {
			this.renderSection(container, "Event clocks", clocks);
		}
		if (tracks.length > 0) {
			this.renderSection(container, "Tracks", tracks);
		}
		if (timers.length > 0) {
			this.renderSection(container, "Timers", timers);
		}
	}

	private renderSection(
		container: HTMLElement,
		title: string,
		items: ParsedProgress[]
	): void {
		const section = container.createDiv({
			cls: "lonelog-progress-section",
		});

		section.createEl("h5", { text: title });

		items.forEach((item) => {
			this.renderProgressItem(section, item);
		});
	}

	private renderProgressItem(
		container: HTMLElement,
		item: ParsedProgress
	): void {
		const itemEl = container.createDiv({
			cls: "lonelog-progress-item",
		});

		// Name and jump button
		const nameRow = itemEl.createDiv({
			cls: "lonelog-progress-name-row",
		});

		const nameBtn = nameRow.createEl("button", {
			text: item.name,
			cls: "lonelog-progress-name",
		});
		nameBtn.addEventListener("click", () => {
			this.jumpToLine(item.line);
		});

		// Progress bar and controls
		const controlsRow = itemEl.createDiv({
			cls: "lonelog-progress-controls",
		});

		// Decrement button
		const decrementBtn = controlsRow.createEl("button", {
			text: "−",
			cls: "lonelog-progress-btn lonelog-progress-decrement",
		});
		decrementBtn.addEventListener("click", () => {
			void this.updateProgress(item, -1);
		});

		// Progress display
		const progressText = controlsRow.createSpan({
			cls: "lonelog-progress-text",
		});

		if (item.max !== undefined) {
			// Clock or Track (with max)
			const currentDisplay = Number.isInteger(item.current) ? item.current.toString() : item.current.toString();
			const maxDisplay = Number.isInteger(item.max) ? item.max.toString() : item.max.toString();
			progressText.setText(`${currentDisplay}/${maxDisplay}`);

			// Progress bar
			const progressBar = controlsRow.createDiv({
				cls: "lonelog-progress-bar",
			});
			const percentage = (item.current / item.max) * 100;
			const fill = progressBar.createDiv({
				cls: "lonelog-progress-fill",
			});
			fill.style.width = `${percentage}%`;
		} else {
			// Timer (no max)
			progressText.setText(`${item.current}`);
		}

		// Increment button
		const incrementBtn = controlsRow.createEl("button", {
			text: "+",
			cls: "lonelog-progress-btn lonelog-progress-increment",
		});
		incrementBtn.addEventListener("click", () => {
			void this.updateProgress(item, 1);
		});
	}

	/**
	 * Format a number for display: drops unnecessary trailing zeros
	 * but preserves fractional precision (e.g. 1.5 stays "1.5", 2 stays "2").
	 */
	private formatNumber(value: number): string {
		return Number.isInteger(value) ? value.toString() : parseFloat(value.toFixed(4)).toString();
	}

	private async updateProgress(
		item: ParsedProgress,
		delta: number
	): Promise<void> {
		if (!this.campaign) return;

		// Find the file and line the item was parsed from
		const target = resolveLine(this.campaign.segments, item.line);
		if (!target) return;

		const content = await this.app.vault.read(target.file);
		const lines = content.split("\n");

		// Find and update the line
		if (target.line < lines.length) {
			const line = lines[target.line];
			if (!line) return;
			const newCurrent = Math.max(0, parseFloat((item.current + delta).toFixed(4)));

			let newLine: string;
			if (item.type === "clock") {
				// [E:Name X/Y]
				newLine = line.replace(
					/\[E:([^\]]+)\s+(\d+)\/(\d+)\]/,
					`[E:$1 ${newCurrent}/$3]`
				);
			} else if (item.type === "track") {
				if (item.max !== undefined) {
					// [Track:Name X/Y] — supports fractional values
					newLine = line.replace(
						/\[Track:([^\]]+)\s+([\d.]+)\/([\d.]+)\]/,
						`[Track:$1 ${this.formatNumber(newCurrent)}/$3]`
					);
				} else {
					// [Track:Name X] — no max
					newLine = line.replace(
						/\[Track:([^\]]+)\s+([\d.]+)\]/,
						`[Track:$1 ${this.formatNumber(newCurrent)}]`
					);
				}
			} else {
				// [Timer:Name X]
				newLine = line.replace(
					/\[Timer:([^\]]+)\s+(\d+)\]/,
					`[Timer:$1 ${newCurrent}]`
				);
			}

			lines[target.line] = newLine;
			await this.app.vault.modify(target.file, lines.join("\n"));

			// Refresh view
			void this.refresh();
		}
	}

	async onClose(): Promise<void> {
		// Cleanup
	}
}
