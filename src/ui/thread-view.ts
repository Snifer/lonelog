/**
 * Thread Browser Panel
 * Displays all NPCs, locations, threads, and PCs with navigation
 */

import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { t } from "../i18n/i18n";
import {
	NotationParser,
	ParsedElements,
	ParsedNPC,
	ParsedLocation,
	ParsedThread,
	ParsedPC,
} from "../utils/parser";

export const THREAD_VIEW_TYPE = "lonelog-thread-view";

export class ThreadBrowserView extends ItemView {
	private parsedElements: ParsedElements | null = null;
	private currentFile: TFile | null = null;
	private lastRefreshId: number = 0;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return THREAD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.thread-title");
	}

	getIcon(): string {
		return "list";
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("lonelog-thread-container");

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
				text: t("views.no-active-file"),
				cls: "lonelog-empty-state",
			});
			return;
		}

		this.currentFile = activeFile;

		// Read and parse file
		const content = await this.app.vault.read(activeFile);

		// If a new refresh has started, don't proceed with this one
		if (refreshId !== this.lastRefreshId) return;

		this.parsedElements = NotationParser.parse(content);

		// Render header
		const header = container.createEl("div", {
			cls: "lonelog-thread-header",
		});
		header.createEl("h4", { text: t("views.story-header") });

		const totalCount =
			this.parsedElements.npcs.size +
			this.parsedElements.locations.size +
			this.parsedElements.threads.size +
			this.parsedElements.pcs.size;

		header.createEl("span", {
			text: `${totalCount} ${t("views.items")}`,
			cls: "lonelog-count",
		});

		// Check if empty
		if (totalCount === 0) {
			container.createEl("div", {
				text: t("views.no-story"),
				cls: "lonelog-empty-state",
			});
			return;
		}

		// Render each category
		if (this.parsedElements.pcs.size > 0) {
			this.renderPCSection(container, this.parsedElements.pcs);
		}

		if (this.parsedElements.npcs.size > 0) {
			this.renderNPCSection(container, this.parsedElements.npcs);
		}

		if (this.parsedElements.locations.size > 0) {
			this.renderLocationSection(
				container,
				this.parsedElements.locations
			);
		}

		if (this.parsedElements.threads.size > 0) {
			this.renderThreadSection(container, this.parsedElements.threads);
		}

		// Phase 4: Tags navigation
		this.renderTagSection(container, this.parsedElements);
	}

	private renderPCSection(
		container: HTMLElement,
		pcs: Map<string, ParsedPC>
	): void {
		const section = container.createEl("div", {
			cls: "lonelog-thread-section",
		});

		const sectionHeader = section.createEl("div", {
			cls: "lonelog-thread-section-header",
		});
		sectionHeader.createEl("h5", { text: t("views.pcs") });
		sectionHeader.createEl("span", {
			text: `${pcs.size}`,
			cls: "lonelog-section-count",
		});

		const list = section.createEl("div", { cls: "lonelog-thread-list" });

		Array.from(pcs.values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach((pc) => {
				this.renderEntityItem(list, pc.name, pc.tags, pc.mentions);
			});
	}

	private renderNPCSection(
		container: HTMLElement,
		npcs: Map<string, ParsedNPC>
	): void {
		const section = container.createEl("div", {
			cls: "lonelog-thread-section",
		});

		const sectionHeader = section.createEl("div", {
			cls: "lonelog-thread-section-header",
		});
		sectionHeader.createEl("h5", { text: t("views.npcs") });
		sectionHeader.createEl("span", {
			text: `${npcs.size}`,
			cls: "lonelog-section-count",
		});

		const list = section.createEl("div", { cls: "lonelog-thread-list" });

		Array.from(npcs.values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach((npc) => {
				this.renderEntityItem(list, npc.name, npc.tags, npc.mentions);
			});
	}

	private renderLocationSection(
		container: HTMLElement,
		locations: Map<string, ParsedLocation>
	): void {
		const section = container.createEl("div", {
			cls: "lonelog-thread-section",
		});

		const sectionHeader = section.createEl("div", {
			cls: "lonelog-thread-section-header",
		});
		sectionHeader.createEl("h5", { text: t("views.locations") });
		sectionHeader.createEl("span", {
			text: `${locations.size}`,
			cls: "lonelog-section-count",
		});

		const list = section.createEl("div", { cls: "lonelog-thread-list" });

		Array.from(locations.values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach((location) => {
				this.renderEntityItem(
					list,
					location.name,
					location.tags,
					location.mentions
				);
			});
	}

	private renderThreadSection(
		container: HTMLElement,
		threads: Map<string, ParsedThread>
	): void {
		const section = container.createEl("div", {
			cls: "lonelog-thread-section",
		});

		const sectionHeader = section.createEl("div", {
			cls: "lonelog-thread-section-header",
		});
		sectionHeader.createEl("h5", { text: t("views.threads") });
		sectionHeader.createEl("span", {
			text: `${threads.size}`,
			cls: "lonelog-section-count",
		});

		const list = section.createEl("div", { cls: "lonelog-thread-list" });

		Array.from(threads.values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach((thread) => {
				this.renderThreadItem(
					list,
					thread.name,
					thread.state,
					thread.mentions
				);
			});
	}

	private renderEntityItem(
		container: HTMLElement,
		name: string,
		tags: string[],
		mentions: number[]
	): void {
		const item = container.createEl("div", {
			cls: "lonelog-thread-item",
		});

		const nameRow = item.createEl("div", {
			cls: "lonelog-thread-item-name-row",
		});

		const nameBtn = nameRow.createEl("button", {
			text: name,
			cls: "lonelog-thread-item-name",
		});
		nameBtn.addEventListener("click", () => {
			if (mentions[0] !== undefined) {
				this.jumpToLine(mentions[0]);
			}
		});

		nameRow.createEl("span", {
			text: `×${mentions.length}`,
			cls: "lonelog-mention-count",
		});

		if (tags.length > 0) {
			const tagsEl = item.createEl("div", {
				cls: "lonelog-thread-item-tags",
			});
			tagsEl.setText(tags.join(" | "));
		}

		// Mention navigation
		if (mentions.length > 1) {
			const mentionsNav = item.createEl("div", {
				cls: "lonelog-mentions-nav",
			});
			mentions.forEach((line, index) => {
				const mentionBtn = mentionsNav.createEl("button", {
					text: `${index + 1}`,
					cls: "lonelog-mention-btn",
				});
				mentionBtn.addEventListener("click", () => {
					this.jumpToLine(line);
				});
			});
		}
	}

	private renderTagSection(
		container: HTMLElement,
		elements: ParsedElements
	): void {
		const tagMap = new Map<string, Array<{ name: string; type: string }>>();

		const addTags = (tags: string[], name: string, type: string) => {
			tags.forEach((tag) => {
				if (!tagMap.has(tag)) tagMap.set(tag, []);
				const exists = tagMap.get(tag)!.some(e => e.name === name);
				if (!exists) {
					tagMap.get(tag)!.push({ name, type });
				}
			});
		};

		elements.npcs.forEach((val, key) => addTags(val.tags, key, "npc"));
		elements.locations.forEach((val, key) => addTags(val.tags, key, "location"));
		elements.pcs.forEach((val, key) => addTags(val.tags, key, "pc"));

		if (tagMap.size === 0) return;

		const section = container.createEl("div", {
			cls: "lonelog-thread-section",
		});

		const sectionHeader = section.createEl("div", {
			cls: "lonelog-thread-section-header",
		});
		sectionHeader.createEl("h5", { text: t("views.tags") });
		sectionHeader.createEl("span", {
			text: `${tagMap.size}`,
			cls: "lonelog-section-count",
		});

		const tagCloud = section.createEl("div", { cls: "lonelog-tag-cloud" });

		Array.from(tagMap.keys())
			.sort((a, b) => a.localeCompare(b))
			.forEach((tagName) => {
				const tagContainer = tagCloud.createEl("div", {
					cls: "lonelog-tag-group",
				});
				tagContainer.createEl("span", {
					text: tagName,
					cls: "lonelog-tag-badge",
				});

				const entities = tagMap.get(tagName)!;
				const entityList = tagContainer.createEl("div", {
					cls: "lonelog-tag-entities",
				});
				entities.forEach((entity) => {
					const entityBtn = entityList.createEl("button", {
						text: entity.name,
						cls: `lonelog-tag-entity-btn lonelog-entity-${entity.type}`,
					});
					entityBtn.onclick = () => {
						let mentions: number[] = [];
						if (entity.type === "npc")
							mentions = elements.npcs.get(entity.name)?.mentions || [];
						else if (entity.type === "location")
							mentions =
								elements.locations.get(entity.name)?.mentions || [];
						else if (entity.type === "pc")
							mentions = elements.pcs.get(entity.name)?.mentions || [];

						if (mentions.length > 0) {
							this.jumpToLine(mentions[0]!);
						}
					};
				});
			});
	}

	private renderThreadItem(
		container: HTMLElement,
		name: string,
		state: string,
		mentions: number[]
	): void {
		const item = container.createEl("div", {
			cls: "lonelog-thread-item",
		});

		const nameRow = item.createEl("div", {
			cls: "lonelog-thread-item-name-row",
		});

		const nameBtn = nameRow.createEl("button", {
			text: name,
			cls: "lonelog-thread-item-name",
		});
		nameBtn.addEventListener("click", () => {
			if (mentions[0] !== undefined) {
				this.jumpToLine(mentions[0]);
			}
		});

		nameRow.createEl("span", {
			text: state,
			cls: `lonelog-thread-state lonelog-thread-state-${state.toLowerCase()}`,
		});

		// Mention navigation
		if (mentions.length > 1) {
			const mentionsNav = item.createEl("div", {
				cls: "lonelog-mentions-nav",
			});
			mentions.forEach((line, index) => {
				const mentionBtn = mentionsNav.createEl("button", {
					text: `${index + 1}`,
					cls: "lonelog-mention-btn",
				});
				mentionBtn.addEventListener("click", () => {
					this.jumpToLine(line);
				});
			});
		}
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

	async onClose(): Promise<void> {
		// Cleanup
	}
}
