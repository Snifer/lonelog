import { ItemView, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { t } from "../i18n/i18n";
import LonelogPlugin from "../main";
import {
	PartylogParsedDocument,
	PartylogParser,
	PartylogTimelineEntry,
} from "../utils/partylog-parser";
import { ParsedEntity, ParsedSession, ParsedThread } from "../utils/parser";

export const PARTYLOG_DASHBOARD_VIEW_TYPE = "lonelog-partylog-dashboard";

type PartylogTab = "overview" | "scenes" | "threads" | "timeline" | "roster" | "recap";

export class PartylogDashboardView extends ItemView {
	private currentFile: TFile | null = null;
	private plugin: LonelogPlugin;
	private activeTab: PartylogTab = "overview";
	private debouncedRefresh = debounce(() => this.refresh(), 300, true);

	constructor(leaf: WorkspaceLeaf, plugin: LonelogPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return PARTYLOG_DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.partylog-dashboard-title");
	}

	getIcon(): string {
		return "users";
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("lonelog-dashboard-container");
		this.contentEl.addClass("lonelog-partylog-dashboard");

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.debouncedRefresh();
			})
		);

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file === this.currentFile) {
					this.debouncedRefresh();
				}
			})
		);

		this.debouncedRefresh();
		return Promise.resolve();
	}

	async refresh(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		if (!this.plugin.settings.enablePartylogAddon) {
			container.createEl("h1", { text: t("views.partylog-dashboard-title") });
			container.createEl("p", { text: t("views.partylog-addon-disabled") });
			return;
		}

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
		const parsed = PartylogParser.parse(content);

		this.renderHeader(container, activeFile.basename, parsed);

		if (!parsed.hasPartylogBlocks) {
			const empty = container.createEl("div", { cls: "ll-dashboard-section" });
			empty.createEl("p", { text: t("views.partylog-stage1-empty") });
			return;
		}

		this.renderTabs(container, parsed);
	}

	private renderHeader(container: HTMLElement, filename: string, parsed: PartylogParsedDocument): void {
		const header = container.createEl("div", { cls: "ll-dashboard-header" });
		header.createEl("h1", { text: t("views.partylog-dashboard-title") });
		header.createEl("p", {
			text: `${t("views.partylog-dashboard-subtitle")} · ${filename}`,
			cls: "ll-empty-hint",
		});

		if (!parsed.hasPartylogBlocks) return;

		const stats = header.createEl("div", { cls: "ll-header-stats" });
		this.createStatCard(stats, t("views.sessions"), String(parsed.sessions.length));
		this.createStatCard(stats, t("views.scenes"), String(parsed.sessions.reduce((sum, session) => sum + session.scenes.length, 0)));
		this.createStatCard(stats, t("views.partylog-stat-actions"), String(parsed.timeline.filter((entry) => entry.type === "action").length));
		this.createStatCard(stats, t("views.partylog-stat-events"), String(parsed.timeline.filter((entry) => entry.type === "world-event").length));
		this.createStatCard(stats, t("views.partylog-stat-rolls"), String(parsed.timeline.filter((entry) => entry.type === "dice").length));
		this.createStatCard(stats, t("views.partylog-stat-roster"), String(parsed.roster.size));
		this.createStatCard(stats, t("views.partylog-stat-dialogue"), String(parsed.dialogue.length));
		this.createStatCard(stats, t("views.partylog-stat-meta"), String(parsed.meta.length));
		this.createStatCard(stats, t("views.partylog-stat-narrative"), String(parsed.narrativeBlocks.length));
	}

	private renderTabs(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const tabsShell = container.createEl("div", { cls: "ll-dashboard-section" });
		const tabBar = tabsShell.createEl("div", { cls: "ll-thread-section-header" });

		const tabs: Array<{ key: PartylogTab; label: string }> = [
			{ key: "overview", label: t("views.partylog-tab-overview") },
			{ key: "scenes", label: t("views.partylog-tab-scenes") },
			{ key: "threads", label: t("views.partylog-tab-threads") },
			{ key: "timeline", label: t("views.partylog-tab-timeline") },
			{ key: "roster", label: t("views.partylog-tab-roster") },
			{ key: "recap", label: t("views.partylog-tab-recap") },
		];

		tabs.forEach((tab) => {
			const button = tabBar.createEl("button", {
				text: tab.label,
				cls: this.activeTab === tab.key ? "lonelog-scene-btn is-active" : "lonelog-scene-btn",
			});
			button.addEventListener("click", () => {
				this.activeTab = tab.key;
				void this.refresh();
			});
		});

		this.renderWarningBanner(container, parsed);

		const body = container.createEl("div", { cls: "ll-dashboard-grid" });
		switch (this.activeTab) {
			case "overview":
				this.renderOverview(body, parsed);
				break;
			case "scenes":
				this.renderScenes(body, parsed);
				break;
			case "threads":
				this.renderThreads(body, parsed);
				break;
			case "timeline":
				this.renderTimeline(body, parsed);
				break;
			case "roster":
				this.renderRoster(body, parsed);
				break;
			case "recap":
				this.renderRecap(body, parsed);
				break;
		}
	}

	private renderWarningBanner(container: HTMLElement, parsed: PartylogParsedDocument): void {
		if (parsed.authorityWarnings.length === 0) return;

		const banner = container.createEl("div", {
			cls: "ll-dashboard-section ll-partylog-warning-banner",
		});
		banner.createEl("h2", { text: `⚠ ${t("views.partylog-authority-warnings")}` });
		parsed.authorityWarnings.forEach((warning) => {
			const row = banner.createEl("div", { cls: "ll-thread-state" });
			row.setText(warning.message);
			row.addEventListener("click", () => this.jumpToLine(warning.line));
		});
	}

	private renderOverview(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const left = container.createEl("div", { cls: "ll-dashboard-col ll-timeline-col" });
		const right = container.createEl("div", { cls: "ll-dashboard-col ll-data-col" });

		const recent = left.createEl("div", { cls: "ll-dashboard-section" });
		recent.createEl("h2", { text: t("views.partylog-overview-recent") });
		const latestEntries = parsed.timeline.slice(-10);
		if (latestEntries.length === 0) {
			recent.createEl("div", { text: t("views.partylog-empty-timeline"), cls: "ll-empty-hint" });
		} else {
			this.renderGroupedTimeline(recent, latestEntries);
		}

		const dialogueSection = left.createEl("div", { cls: "ll-dashboard-section" });
		dialogueSection.createEl("h2", { text: t("views.partylog-dialogue-highlights") });
		this.renderDialogueSection(dialogueSection, parsed, 5);

		const scenes = right.createEl("div", { cls: "ll-dashboard-section" });
		scenes.createEl("h2", { text: t("views.partylog-overview-scenes") });
		const latestScene = this.getLatestScene(parsed.sessions);
		if (latestScene) {
			const row = scenes.createEl("div", { cls: "ll-entity-item" });
			row.createEl("span", { text: latestScene.number, cls: "ll-entity-name" });
			row.createEl("span", { text: latestScene.context, cls: "ll-thread-state" });
		} else if (parsed.interludes.length > 0) {
			const latestInterlude = parsed.interludes[parsed.interludes.length - 1];
			if (latestInterlude) {
				scenes.createEl("div", { text: latestInterlude.title, cls: "ll-thread-state" });
			}
		} else {
			scenes.createEl("div", { text: t("views.no-scenes"), cls: "ll-empty-hint" });
		}

		const threads = right.createEl("div", { cls: "ll-dashboard-section" });
		threads.createEl("h2", { text: t("views.partylog-overview-threads") });
		const tracked = [
			...Array.from(parsed.threads.values()).map((item) => `${item.name} — ${item.state}`),
			...Array.from(parsed.goals.values()).map((item) => `${item.name} — ${item.state}`),
			...Array.from(parsed.quests.values()).map((item) => `${item.name} — ${item.state}`),
		].slice(0, 8);
		if (tracked.length === 0) {
			threads.createEl("div", { text: t("views.no-story"), cls: "ll-empty-hint" });
		} else {
			tracked.forEach((item) => threads.createEl("div", { text: item, cls: "ll-thread-state" }));
		}

		const richContent = right.createEl("div", { cls: "ll-dashboard-section" });
		richContent.createEl("h2", { text: t("views.partylog-rich-content") });
		this.renderMiniMetricList(richContent, [
			`${t("views.partylog-stat-meta")}: ${parsed.meta.length}`,
			`${t("views.partylog-stat-narrative")}: ${parsed.narrativeBlocks.length}`,
			`${t("views.partylog-interludes")}: ${parsed.interludes.length}`,
			`${t("views.partylog-session-endings")}: ${parsed.sessionEnds.length}`,
		]);

		const metaPreview = right.createEl("div", { cls: "ll-dashboard-section" });
		metaPreview.createEl("h2", { text: t("views.partylog-meta-notes") });
		this.renderMetaSection(metaPreview, parsed, 4);

		const narrativePreview = right.createEl("div", { cls: "ll-dashboard-section" });
		narrativePreview.createEl("h2", { text: t("views.partylog-narrative-blocks") });
		this.renderNarrativeSection(narrativePreview, parsed, 3);
	}

	private renderScenes(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const section = container.createEl("div", { cls: "ll-dashboard-col" });
		const card = section.createEl("div", { cls: "ll-dashboard-section" });
		card.createEl("h2", { text: t("views.partylog-tab-scenes") });

		if (parsed.sessions.length === 0 && parsed.interludes.length === 0) {
			card.createEl("div", { text: t("views.no-sessions"), cls: "ll-empty-hint" });
			return;
		}

		parsed.sessions.forEach((session) => {
			const sessionEl = card.createEl("div", { cls: "lonelog-scene-session" });
			const header = sessionEl.createEl("div", { cls: "lonelog-scene-session-header" });
			const btn = header.createEl("button", { cls: "lonelog-scene-session-btn" });
			btn.createEl("strong", { text: `${t("views.session")} ${session.number}` });
			if (session.date) btn.createEl("span", { text: ` • ${session.date}`, cls: "lonelog-scene-date" });
			btn.addEventListener("click", () => this.jumpToLine(session.line));
			header.createEl("span", { text: `${session.scenes.length} ${t("views.scenes")}`, cls: "lonelog-scene-count" });

			const scenesList = sessionEl.createEl("div", { cls: "lonelog-scene-list" });
			session.scenes.forEach((scene) => {
				const item = scenesList.createEl("button", { cls: "lonelog-scene-btn" });
				item.createEl("span", { text: scene.number, cls: "lonelog-scene-number" });
				item.createEl("span", { text: scene.context, cls: "lonelog-scene-context" });
				item.addEventListener("click", () => this.jumpToLine(scene.line));
			});
		});

		if (parsed.interludes.length > 0) {
			const interludeSection = card.createEl("div", { cls: "lonelog-scene-session" });
			interludeSection.createEl("h3", { text: t("views.partylog-interludes") });
			parsed.interludes.forEach((interlude) => {
				const item = interludeSection.createEl("button", { cls: "lonelog-scene-btn" });
				item.createEl("span", { text: interlude.title, cls: "lonelog-scene-context" });
				item.addEventListener("click", () => this.jumpToLine(interlude.line));
			});
		}

		if (parsed.sessionEnds.length > 0) {
			const endings = card.createEl("div", { cls: "lonelog-scene-session" });
			endings.createEl("h3", { text: t("views.partylog-session-endings") });
			parsed.sessionEnds.forEach((entry) => {
				const row = endings.createEl("button", { cls: "lonelog-scene-btn" });
				row.createEl("span", { text: `Session ${entry.sessionNumber ?? "?"}`, cls: "lonelog-scene-number" });
				row.createEl("span", { text: `${entry.advancements.length} advancements · ${entry.hooks.length} hooks`, cls: "lonelog-scene-context" });
				row.addEventListener("click", () => this.jumpToLine(entry.line));
			});
		}
	}

	private renderThreads(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const left = container.createEl("div", { cls: "ll-dashboard-col ll-data-col" });
		const right = container.createEl("div", { cls: "ll-dashboard-col ll-data-col" });

		this.renderEntityMapSection(left, t("views.pcs"), parsed.pcs);
		this.renderEntityMapSection(left, t("views.npcs"), parsed.npcs);
		this.renderEntityMapSection(left, t("views.locations"), parsed.locations);
		this.renderThreadMapSection(left, t("views.threads"), parsed.threads);
		this.renderPartyResourcesSection(right, parsed);
		this.renderFactionsSection(right, parsed);
		this.renderObjectivesSection(right, t("views.partylog-goals"), parsed.goals);
		this.renderObjectivesSection(right, t("views.partylog-quests"), parsed.quests);
		this.renderLootSection(right, parsed);
	}

	private renderTimeline(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const section = container.createEl("div", { cls: "ll-dashboard-col" });
		const card = section.createEl("div", { cls: "ll-dashboard-section" });
		card.createEl("h2", { text: t("views.partylog-tab-timeline") });

		if (parsed.timeline.length === 0) {
			card.createEl("div", { text: t("views.partylog-empty-timeline"), cls: "ll-empty-hint" });
			return;
		}

		this.renderGroupedTimeline(card, parsed.timeline);

		const detailGrid = section.createEl("div", { cls: "ll-dashboard-grid" });
		const detailLeft = detailGrid.createEl("div", { cls: "ll-dashboard-col ll-data-col" });
		const detailRight = detailGrid.createEl("div", { cls: "ll-dashboard-col ll-data-col" });

		const dialogueCard = detailLeft.createEl("div", { cls: "ll-dashboard-section" });
		dialogueCard.createEl("h2", { text: t("views.partylog-dialogue-stream") });
		this.renderDialogueSection(dialogueCard, parsed, 10);

		const metaCard = detailRight.createEl("div", { cls: "ll-dashboard-section" });
		metaCard.createEl("h2", { text: t("views.partylog-meta-notes") });
		this.renderMetaSection(metaCard, parsed, 8);

		const narrativeCard = detailRight.createEl("div", { cls: "ll-dashboard-section" });
		narrativeCard.createEl("h2", { text: t("views.partylog-narrative-blocks") });
		this.renderNarrativeSection(narrativeCard, parsed, 6);
	}

	private renderRoster(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const section = container.createEl("div", { cls: "ll-dashboard-col" });
		const card = section.createEl("div", { cls: "ll-dashboard-section" });
		card.createEl("h2", { text: t("views.partylog-tab-roster") });

		const roster = Array.from(parsed.roster.values()).sort((a, b) => {
			const totalA = a.actionCount + a.rollCount + a.questionCount + a.dialogueCount;
			const totalB = b.actionCount + b.rollCount + b.questionCount + b.dialogueCount;
			return totalB - totalA || a.name.localeCompare(b.name);
		});

		if (roster.length === 0) {
			card.createEl("div", { text: t("views.partylog-empty-roster"), cls: "ll-empty-hint" });
			return;
		}

		roster.forEach((entry) => {
			const row = card.createEl("div", { cls: "ll-entity-item" });
			const info = row.createEl("div");
			info.createEl("div", { text: entry.name, cls: "ll-entity-name" });
			const meta: string[] = [];
			const total = entry.actionCount + entry.rollCount + entry.questionCount + entry.dialogueCount;
			meta.push(`${t("views.partylog-stat-total")}: ${total}`);
			meta.push(`${t("views.partylog-stat-actions")}: ${entry.actionCount}`);
			meta.push(`${t("views.partylog-stat-rolls")}: ${entry.rollCount}`);
			if (entry.questionCount > 0) meta.push(`${t("views.partylog-stat-questions")}: ${entry.questionCount}`);
			if (entry.dialogueCount > 0) meta.push(`${t("views.partylog-stat-dialogue")}: ${entry.dialogueCount}`);
			if (entry.lastSceneNumber) meta.push(`${entry.lastSceneNumber}${entry.lastSceneContext ? ` • ${entry.lastSceneContext}` : ""}`);
			if (!entry.lastSceneNumber && entry.lastInterludeTitle) meta.push(entry.lastInterludeTitle);
			info.createEl("div", { text: meta.join(" · "), cls: "ll-thread-state" });
		});
	}

	private renderRecap(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const section = container.createEl("div", { cls: "ll-dashboard-col" });
		const card = section.createEl("div", { cls: "ll-dashboard-section" });
		card.createEl("h2", { text: t("views.partylog-tab-recap") });

		if (parsed.timeline.length === 0) {
			card.createEl("div", { text: t("views.partylog-empty-recap"), cls: "ll-empty-hint" });
			return;
		}

		const latestSession = parsed.sessions.length > 0 ? parsed.sessions[parsed.sessions.length - 1] : undefined;
		if (latestSession) {
			card.createEl("p", {
				text: `${t("views.session")} ${latestSession.number} · ${latestSession.scenes.length} ${t("views.scenes").toLowerCase()}`,
			});
		}

		if (parsed.sessionEnds.length > 0) {
			const latestEnd = parsed.sessionEnds[parsed.sessionEnds.length - 1];
			if (latestEnd && latestEnd.hooks.length > 0) {
				card.createEl("p", { text: `${t("views.partylog-hooks")}: ${latestEnd.hooks.join(" | ")}` });
			}
		}

		const topActors = Array.from(parsed.roster.values())
			.sort((a, b) => (b.actionCount + b.rollCount + b.questionCount + b.dialogueCount) - (a.actionCount + a.rollCount + a.questionCount + a.dialogueCount))
			.slice(0, 3)
			.map((entry) => `${entry.name} (${entry.actionCount}/${entry.rollCount}/${entry.dialogueCount})`);
		if (topActors.length > 0) {
			card.createEl("p", { text: `${t("views.partylog-recap-top-actors")}: ${topActors.join(", ")}` });
		}

		const keyEvents = parsed.timeline
			.filter((entry) => ["world-event", "consequence", "oracle-answer"].includes(entry.type))
			.slice(-6);
		if (keyEvents.length > 0) {
			card.createEl("h3", { text: t("views.partylog-recap-key-events") });
			const list = card.createEl("ul");
			keyEvents.forEach((entry) => {
				list.createEl("li", { text: entry.text || entry.raw.trim() });
			});
		}

		const structured = [
			...Array.from(parsed.goals.values()).slice(0, 3).map((goal) => `${goal.name} — ${goal.state}`),
			...Array.from(parsed.quests.values()).slice(0, 3).map((quest) => `${quest.name} — ${quest.state}`),
			...Array.from(parsed.factions.values()).slice(0, 3).map((faction) => `${faction.name}${faction.standing ? ` — ${faction.standing}` : ""}`),
		];
		if (structured.length > 0) {
			card.createEl("h3", { text: t("views.partylog-structured-state") });
			const list = card.createEl("ul");
			structured.forEach((line) => list.createEl("li", { text: line }));
		}

		if (parsed.dialogue.length > 0) {
			card.createEl("h3", { text: t("views.partylog-notable-quotes") });
			const list = card.createEl("ul");
			parsed.dialogue.slice(-3).forEach((entry) => {
				list.createEl("li", { text: `${entry.speaker}: “${this.truncate(entry.text, 90)}”` });
			});
		}

		if (parsed.meta.length > 0 || parsed.narrativeBlocks.length > 0) {
			card.createEl("h3", { text: t("views.partylog-table-notes-narrative") });
			const list = card.createEl("ul");
			parsed.meta.slice(-3).forEach((entry) => {
				list.createEl("li", { text: `(${entry.kind}:) ${entry.text}` });
			});
			parsed.narrativeBlocks.slice(-2).forEach((entry) => {
				list.createEl("li", { text: `Narrative: ${this.truncate(entry.text, 100)}` });
			});
		}

		if (parsed.meta.length > 0) {
			card.createEl("h3", { text: t("views.partylog-meta-summary") });
			const kindCounts = new Map<string, number>();
			parsed.meta.forEach((entry) => {
				kindCounts.set(entry.kind, (kindCounts.get(entry.kind) ?? 0) + 1);
			});
			const list = card.createEl("ul");
			Array.from(kindCounts.entries())
				.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
				.forEach(([kind, count]) => {
					list.createEl("li", { text: `${kind}: ${count}` });
				});
		}
	}

	private renderEntityMapSection(container: HTMLElement, title: string, entities: Map<string, ParsedEntity>): void {
		const section = container.createEl("div", { cls: "ll-dashboard-section" });
		section.createEl("h2", { text: title });

		if (entities.size === 0) {
			section.createEl("div", { text: t("views.no-story"), cls: "ll-empty-hint" });
			return;
		}

		Array.from(entities.values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach((entity) => {
				const row = section.createEl("div", { cls: "ll-entity-item" });
				row.createEl("span", { text: entity.name, cls: "ll-entity-name" });
				if (entity.tags.length > 0) {
					const tags = row.createEl("div", { cls: "ll-room-statuses" });
					entity.tags.forEach((tag) => tags.createEl("span", { text: tag, cls: "ll-tag-badge" }));
				}
			});
	}

	private renderThreadMapSection(container: HTMLElement, title: string, threads: Map<string, ParsedThread>): void {
		const section = container.createEl("div", { cls: "ll-dashboard-section" });
		section.createEl("h2", { text: title });

		if (threads.size === 0) {
			section.createEl("div", { text: t("views.no-story"), cls: "ll-empty-hint" });
			return;
		}

		Array.from(threads.values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach((thread) => {
				const row = section.createEl("div", { cls: "ll-entity-item" });
				row.createEl("span", { text: thread.name, cls: "ll-entity-name" });
				row.createEl("span", { text: thread.state, cls: "ll-thread-state" });
			});
	}

	private renderPartyResourcesSection(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const section = container.createEl("div", { cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.partylog-party-resources") });
		if (parsed.partyResources.size === 0) {
			section.createEl("div", { text: t("views.no-story"), cls: "ll-empty-hint" });
			return;
		}
		Array.from(parsed.partyResources.values())
			.sort((a, b) => a.key.localeCompare(b.key))
			.forEach((resource) => {
				const row = section.createEl("div", { cls: "ll-entity-item" });
				row.createEl("span", { text: resource.key, cls: "ll-entity-name" });
				row.createEl("span", { text: resource.value, cls: "ll-thread-state" });
			});
	}

	private renderFactionsSection(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const section = container.createEl("div", { cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.partylog-factions") });
		if (parsed.factions.size === 0) {
			section.createEl("div", { text: t("views.no-story"), cls: "ll-empty-hint" });
			return;
		}
		Array.from(parsed.factions.values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach((faction) => {
				const row = section.createEl("div", { cls: "ll-entity-item" });
				row.createEl("span", { text: faction.name, cls: "ll-entity-name" });
				const detail = [faction.tier ? `tier:${faction.tier}` : "", faction.standing ? `standing:${faction.standing}` : "", ...faction.tags]
					.filter(Boolean)
					.join(" · ");
				row.createEl("span", { text: detail, cls: "ll-thread-state" });
			});
	}

	private renderObjectivesSection(container: HTMLElement, title: string, objectives: Map<string, { name: string; state: string }>): void {
		const section = container.createEl("div", { cls: "ll-dashboard-section" });
		section.createEl("h2", { text: title });
		if (objectives.size === 0) {
			section.createEl("div", { text: t("views.no-story"), cls: "ll-empty-hint" });
			return;
		}
		Array.from(objectives.values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach((objective) => {
				const row = section.createEl("div", { cls: "ll-entity-item" });
				row.createEl("span", { text: objective.name, cls: "ll-entity-name" });
				row.createEl("span", { text: objective.state, cls: "ll-thread-state" });
			});
	}

	private renderLootSection(container: HTMLElement, parsed: PartylogParsedDocument): void {
		const section = container.createEl("div", { cls: "ll-dashboard-section" });
		section.createEl("h2", { text: t("views.partylog-loot") });
		const activeLoot = Array.from(parsed.loot.values()).filter((item) => item.active);
		if (activeLoot.length === 0) {
			section.createEl("div", { text: t("views.no-story"), cls: "ll-empty-hint" });
			return;
		}
		activeLoot.forEach((item) => {
			const row = section.createEl("div", { cls: "ll-entity-item" });
			row.createEl("span", { text: item.name, cls: "ll-entity-name" });
			row.createEl("span", { text: item.tags.join(" · "), cls: "ll-thread-state" });
		});
	}

	private renderGroupedTimeline(container: HTMLElement, entries: PartylogTimelineEntry[]): void {
		let currentGroup = "";
		entries.forEach((entry) => {
			const groupLabel = this.getTimelineGroupLabel(entry);
			if (groupLabel !== currentGroup) {
				currentGroup = groupLabel;
				container.createEl("h3", { text: groupLabel });
			}
			this.renderTimelineEntry(container, entry);
		});
	}

	private getTimelineGroupLabel(entry: PartylogTimelineEntry): string {
		if (entry.sceneNumber) {
			return entry.sceneContext ? `${entry.sceneNumber} · ${entry.sceneContext}` : entry.sceneNumber;
		}
		if (entry.interludeTitle) return `Interlude · ${entry.interludeTitle}`;
		if (entry.sessionNumber) return `Session ${entry.sessionNumber}`;
		return t("views.partylog-ungrouped");
	}

	private renderTimelineEntry(container: HTMLElement, entry: PartylogTimelineEntry): void {
		const row = container.createEl("div", { cls: "ll-entity-item" });
		row.addEventListener("click", () => this.jumpToLine(entry.line));

		const title = row.createEl("div");
		title.createEl("div", { text: this.getTimelineLabel(entry), cls: "ll-entity-name" });

		const meta: string[] = [];
		if (entry.sceneNumber) meta.push(entry.sceneNumber);
		if (entry.sceneContext) meta.push(entry.sceneContext);
		if (!entry.sceneNumber && entry.interludeTitle) meta.push(entry.interludeTitle);
		const detailParts = [entry.text, entry.outcome ? `→ ${entry.outcome}` : ""].filter(Boolean);
		if (detailParts.length > 0) meta.push(detailParts.join(" "));
		row.createEl("div", { text: meta.join(" · "), cls: "ll-thread-state" });
	}

	private getTimelineLabel(entry: PartylogTimelineEntry): string {
		switch (entry.type) {
			case "action":
				return entry.actor ? `@(${entry.actor})` : "@";
			case "world-event":
				return "!";
			case "question":
				return entry.actor ? `?(${entry.actor})` : "?";
			case "oracle-answer":
				return "->";
			case "dice":
				return entry.actor ? `d(${entry.actor}):` : "d:";
			case "consequence":
				return "=>";
			case "dialogue":
				return entry.actor ? `${entry.actor}:` : "dialogue";
			case "meta":
				return entry.metaKind ? `(${entry.metaKind}:)` : "(meta:)";
			case "table":
				return "tbl:";
			case "generator":
				return "gen:";
		}
	}

	private getLatestScene(sessions: ParsedSession[]) {
		const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : undefined;
		if (!latestSession || latestSession.scenes.length === 0) return undefined;
		return latestSession.scenes[latestSession.scenes.length - 1];
	}

	private renderMiniMetricList(container: HTMLElement, lines: string[]): void {
		lines.forEach((line) => container.createEl("div", { text: line, cls: "ll-thread-state" }));
	}

	private renderDialogueSection(container: HTMLElement, parsed: PartylogParsedDocument, limit: number): void {
		if (parsed.dialogue.length === 0) {
			container.createEl("div", { text: t("views.partylog-empty-dialogue"), cls: "ll-empty-hint" });
			return;
		}

		parsed.dialogue.slice(-limit).forEach((entry) => {
			const row = container.createEl("div", { cls: "ll-entity-item" });
			row.addEventListener("click", () => this.jumpToLine(entry.line));
			row.createEl("div", { text: entry.speaker, cls: "ll-entity-name" });
			const speakerMeta = [this.getSpeakerLabel(entry.speakerType)];
			if (entry.sceneNumber) speakerMeta.push(entry.sceneNumber);
			else if (entry.interludeTitle) speakerMeta.push(entry.interludeTitle);
			row.createEl("div", { text: speakerMeta.join(" · "), cls: "ll-thread-state" });
			row.createEl("div", { text: `“${entry.text}”`, cls: "ll-thread-state" });
		});
	}

	private renderMetaSection(container: HTMLElement, parsed: PartylogParsedDocument, limit: number): void {
		if (parsed.meta.length === 0) {
			container.createEl("div", { text: t("views.partylog-empty-meta"), cls: "ll-empty-hint" });
			return;
		}

		parsed.meta.slice(-limit).forEach((entry) => {
			const row = container.createEl("div", { cls: "ll-entity-item" });
			row.addEventListener("click", () => this.jumpToLine(entry.line));
			row.createEl("div", { text: `(${entry.kind}:)`, cls: "ll-entity-name" });
			const metaParts = [...entry.parts];
			if (entry.sceneNumber) metaParts.unshift(entry.sceneNumber);
			else if (entry.interludeTitle) metaParts.unshift(entry.interludeTitle);
			if (metaParts.length > 0) {
				row.createEl("div", { text: metaParts.join(" · "), cls: "ll-thread-state" });
			}
			row.createEl("div", { text: entry.text, cls: "ll-thread-state" });
		});
	}

	private renderNarrativeSection(container: HTMLElement, parsed: PartylogParsedDocument, limit: number): void {
		if (parsed.narrativeBlocks.length === 0) {
			container.createEl("div", { text: t("views.partylog-empty-narrative"), cls: "ll-empty-hint" });
			return;
		}

		parsed.narrativeBlocks.slice(-limit).forEach((entry) => {
			const row = container.createEl("div", { cls: "ll-entity-item" });
			row.addEventListener("click", () => this.jumpToLine(entry.lineStart));
			row.createEl("div", { text: entry.sceneNumber || entry.interludeTitle || `Lines ${entry.lineStart + 1}-${entry.lineEnd + 1}`, cls: "ll-entity-name" });
			if (entry.sceneContext) {
				row.createEl("div", { text: entry.sceneContext, cls: "ll-thread-state" });
			}
			row.createEl("div", { text: this.truncate(entry.text.replace(/\s+/g, " ").trim(), 180), cls: "ll-thread-state" });
		});
	}

	private getSpeakerLabel(type: "pc" | "npc" | "other"): string {
		switch (type) {
			case "pc":
				return t("views.partylog-speaker-pc");
			case "npc":
				return t("views.partylog-speaker-npc");
			default:
				return t("views.partylog-speaker-other");
		}
	}

	private truncate(text: string, max = 120): string {
		return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
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

	private createStatCard(container: HTMLElement, label: string, value: string): void {
		const card = container.createEl("div", { cls: "ll-stat-card" });
		card.createEl("span", { text: value, cls: "ll-stat-value" });
		card.createEl("span", { text: label, cls: "ll-stat-label" });
	}
}
