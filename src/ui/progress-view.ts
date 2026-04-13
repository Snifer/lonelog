/**
 * Progress Tracker Panel
 * Displays and manages all progress elements (clocks, tracks, timers)
 */

import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { NotationParser, ParsedProgress } from "../utils/parser";

export const PROGRESS_VIEW_TYPE = "lonelog-progress-view";

export class ProgressTrackerView extends ItemView {
	private progressElements: ParsedProgress[] = [];
	private currentFile: TFile | null = null;
	private lastRefreshId: number = 0;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return PROGRESS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Lonelog progress";
	}

	getIcon(): string {
		return "clock";
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("lonelog-progress-container");

		// Listen for active file changes
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				void this.refresh();
			})
		);

		// Listen for file modifications
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file === this.currentFile) {
					void this.refresh();
				}
			})
		);

		void this.refresh();
		return Promise.resolve();
	}

	async refresh(): Promise<void> {
		const refreshId = ++this.lastRefreshId;
		const container = this.contentEl;
		container.empty();

		// Get active file
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			container.createEl("div", {
				text: "No active file",
				cls: "lonelog-empty-state",
			});
			return;
		}

		this.currentFile = activeFile;

		// Read and parse file
		const content = await this.app.vault.read(activeFile);
		
		// If a new refresh has started, don't proceed with this one
		if (refreshId !== this.lastRefreshId) return;

		const parsed = NotationParser.parse(content);
		this.progressElements = parsed.progress;

		// Render header
		const header = container.createEl("div", {
			cls: "lonelog-progress-header",
		});
		header.createEl("h4", { text: "Progress tracker" });
		header.createEl("span", {
			text: `${this.progressElements.length} items`,
			cls: "lonelog-count",
		});

		// Group by type
		const clocks = this.progressElements.filter((p) => p.type === "clock");
		const tracks = this.progressElements.filter((p) => p.type === "track");
		const timers = this.progressElements.filter((p) => p.type === "timer");

		if (this.progressElements.length === 0) {
			container.createEl("div", {
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
		const section = container.createEl("div", {
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
		const itemEl = container.createEl("div", {
			cls: "lonelog-progress-item",
		});

		// Name and jump button
		const nameRow = itemEl.createEl("div", {
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
		const controlsRow = itemEl.createEl("div", {
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
		const progressText = controlsRow.createEl("span", {
			cls: "lonelog-progress-text",
		});

		if (item.max !== undefined) {
			// Clock or Track (with max)
			progressText.setText(`${item.current}/${item.max}`);

			// Progress bar
			const progressBar = controlsRow.createEl("div", {
				cls: "lonelog-progress-bar",
			});
			const percentage = (item.current / item.max) * 100;
			const fill = progressBar.createEl("div", {
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

	private async updateProgress(
		item: ParsedProgress,
		delta: number
	): Promise<void> {
		if (!this.currentFile) return;

		const content = await this.app.vault.read(this.currentFile);
		const lines = content.split("\n");

		// Find and update the line
		if (item.line < lines.length) {
			const line = lines[item.line];
			if (!line) return;
			const newCurrent = Math.max(0, item.current + delta);

			let newLine: string;
			if (item.type === "clock") {
				// [E:Name X/Y]
				newLine = line.replace(
					/\[E:([^\]]+)\s+(\d+)\/(\d+)\]/,
					`[E:$1 ${newCurrent}/$3]`
				);
			} else if (item.type === "track") {
				// [Track:Name X/Y]
				newLine = line.replace(
					/\[Track:([^\]]+)\s+(\d+)\/(\d+)\]/,
					`[Track:$1 ${newCurrent}/$3]`
				);
			} else {
				// [Timer:Name X]
				newLine = line.replace(
					/\[Timer:([^\]]+)\s+(\d+)\]/,
					`[Timer:$1 ${newCurrent}]`
				);
			}

			lines[item.line] = newLine;
			await this.app.vault.modify(this.currentFile, lines.join("\n"));

			// Refresh view
			void this.refresh();
		}
	}

	async onClose(): Promise<void> {
		// Cleanup
	}
}
