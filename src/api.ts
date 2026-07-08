import type { App, TFile } from "obsidian";
import type { LonelogSettings } from "./settings";
import { NotationParser, type ParsedElements } from "./utils/parser";
import { tokenizeLine, tokenizeLines, type Token } from "./utils/lonelog-tokenizer";

export const LONELOG_API_VERSION = "1" as const;

const VIEW_TYPES = {
	dashboard: "lonelog-dashboard",
	progress: "lonelog-progress-view",
	threads: "lonelog-thread-view",
	scenes: "lonelog-scene-nav",
	combat: "lonelog-combat-view",
	dungeon: "lonelog-dungeon-view",
	resources: "lonelog-resource-view",
	partylogDashboard: "lonelog-partylog-dashboard",
} as const;

const FRONTMATTER_KEYS = ["ruleset", "start_date", "lonelog"] as const;

const TAG_MARKER_RE = /\[(?:#?(?:N|L|PC|Thread|E|Clock|Track|Timer|F|R|Inv|Wealth|Party|Faction|Goal|Quest|Loot|Advance|OOC)):/m;
const BLOCK_MARKER_RE = /```(?:lonelog|partylog)\b/m;
const LINE_MARKER_RE = /^(?:@(?:\([^)]+\))?|!|\?|d(?:\([^)]+\))?:|=>|\[\/?COMBAT\]|\[\/?DUNGEON STATUS\]|\[\/?RESOURCES\]|(?:###\s*(?:Scene|Escena)\b|T?\d*-?S\d+(?:\.\d+|[a-z])?\b))/im;

type FrontmatterLike = Record<string, unknown> | null | undefined;

export interface LonelogApiHost {
	app: Pick<App, "vault" | "metadataCache">;
	settings: LonelogSettings;
	activateView(viewType: string): Promise<void>;
	showViewSelectorMenu(evt?: MouseEvent): void;
}

export interface LonelogApi {
	apiVersion: typeof LONELOG_API_VERSION;
	parse: {
		content(content: string): ParsedElements;
		file(file: TFile): Promise<ParsedElements>;
		isLonelogNote(target: TFile | string): Promise<boolean>;
	};
	tokenize: {
		line(line: string): Token[];
		lines(lines: string[]): Token[][];
	};
	settings: {
		get(): Readonly<LonelogSettings>;
	};
	views: {
		openDashboard(): Promise<void>;
		openProgressTracker(): Promise<void>;
		openThreadBrowser(): Promise<void>;
		openSceneNavigator(): Promise<void>;
		openCombatTracker(): Promise<void>;
		openDungeonStatus(): Promise<void>;
		openResources(): Promise<void>;
		openPartylogDashboard(): Promise<void>;
		openViewSelector(): void;
	};
}

function hasLonelogFrontmatter(frontmatter: FrontmatterLike): boolean {
	if (!frontmatter) return false;
	return FRONTMATTER_KEYS.some((key) => frontmatter[key] !== undefined);
}

export function isLonelogContent(content: string): boolean {
	return BLOCK_MARKER_RE.test(content) || TAG_MARKER_RE.test(content) || LINE_MARKER_RE.test(content);
}

export function createLonelogApi(host: LonelogApiHost): LonelogApi {
	return {
		apiVersion: LONELOG_API_VERSION,
		parse: {
			content(content: string): ParsedElements {
				return NotationParser.parse(content);
			},
			async file(file: TFile): Promise<ParsedElements> {
				const content = await host.app.vault.read(file);
				return NotationParser.parse(content);
			},
			async isLonelogNote(target: TFile | string): Promise<boolean> {
				if (typeof target === "string") {
					return isLonelogContent(target);
				}

				if (target.extension !== "md") return false;

				const cache = host.app.metadataCache?.getFileCache?.(target);
				if (hasLonelogFrontmatter(cache?.frontmatter)) {
					return true;
				}

				const content = await host.app.vault.read(target);
				return isLonelogContent(content);
			},
		},
		tokenize: {
			line(line: string): Token[] {
				return tokenizeLine(line);
			},
			lines(lines: string[]): Token[][] {
				return tokenizeLines(lines);
			},
		},
		settings: {
			get(): Readonly<LonelogSettings> {
				return { ...host.settings };
			},
		},
		views: {
			openDashboard(): Promise<void> {
				return host.activateView(VIEW_TYPES.dashboard);
			},
			openProgressTracker(): Promise<void> {
				return host.activateView(VIEW_TYPES.progress);
			},
			openThreadBrowser(): Promise<void> {
				return host.activateView(VIEW_TYPES.threads);
			},
			openSceneNavigator(): Promise<void> {
				return host.activateView(VIEW_TYPES.scenes);
			},
			openCombatTracker(): Promise<void> {
				return host.activateView(VIEW_TYPES.combat);
			},
			openDungeonStatus(): Promise<void> {
				return host.activateView(VIEW_TYPES.dungeon);
			},
			openResources(): Promise<void> {
				return host.activateView(VIEW_TYPES.resources);
			},
			openPartylogDashboard(): Promise<void> {
				return host.activateView(VIEW_TYPES.partylogDashboard);
			},
			openViewSelector(): void {
				host.showViewSelectorMenu(undefined);
			},
		},
	};
}

export type { ParsedElements, Token };
