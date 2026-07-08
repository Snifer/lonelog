import type { App, TFile } from "obsidian";
import type { LonelogSettings } from "./settings";
import { NotationParser, type ParsedElements, type ParsedItem, type ParsedProgress, type ParsedRoom } from "./utils/parser";
import { tokenizeLine, tokenizeLines, type Token } from "./utils/lonelog-tokenizer";
import { PartylogParser, type PartylogParsedDocument } from "./utils/partylog-parser";

export const LONELOG_API_VERSION = "1" as const;
export const LONELOG_API_ERROR_CODES = {
	FILE_READ_FAILED: "FILE_READ_FAILED",
	FILE_WRITE_FAILED: "FILE_WRITE_FAILED",
	INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
	INVALID_INPUT: "INVALID_INPUT",
} as const;

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
	app: Pick<App, "vault" | "metadataCache" | "workspace">;
	manifest?: {
		id: string;
		name: string;
		version: string;
		minAppVersion: string;
	};
	settings: LonelogSettings;
	activateView(viewType: string): Promise<void>;
	showViewSelectorMenu(evt?: MouseEvent): void;
}

export interface LonelogApiInfo {
	id: string;
	name: string;
	version: string;
	minAppVersion: string;
	apiVersion: typeof LONELOG_API_VERSION;
}

export interface LonelogApiModuleInfo {
	name: string;
	version: "1";
	stability: "stable";
	deprecated: false;
	replacement?: null;
}

export interface LonelogApiStabilityPolicy {
	apiVersion: typeof LONELOG_API_VERSION;
	defaultStability: "stable";
	additiveChangesWithinV1: true;
	breakingChangesRequireNewApiVersion: true;
	deprecatedSurfaceRemainsUntilNextApiVersion: true;
}

export interface LonelogApiEventRef {
	name: keyof LonelogApiEventMap;
	id: number;
}

export interface LonelogApiEventMap {
	"settings-changed": {
		settings: Readonly<LonelogSettings>;
	};
	"note-changed": {
		file: TFile;
		isLonelogNote: boolean;
		hasPartylogBlocks: boolean;
	};
	"view-opened": {
		viewType: string;
	};
	"progress-mutated": {
		target: "content" | "file";
		file?: TFile;
		tag: string;
		updated: boolean;
		inserted: boolean;
		input: LonelogApiProgressTagInput;
	};
	"resources-inventory-appended": {
		target: "content" | "file";
		file?: TFile;
		tag: string;
		input: LonelogApiInventoryTagInput;
	};
	"resources-wealth-upserted": {
		target: "content" | "file";
		file?: TFile;
		tag: string;
		updated: boolean;
		inserted: boolean;
		input: LonelogApiWealthCurrencyInput;
	};
	"dungeon-room-upserted": {
		target: "content" | "file";
		file?: TFile;
		tag: string;
		updated: boolean;
		inserted: boolean;
		input: LonelogApiRoomTagInput;
	};
	"partylog-entry-appended": {
		target: "content" | "file";
		file?: TFile;
		entry: string;
		input: LonelogApiPartylogEntryInput;
	};
	"partylog-tag-appended": {
		target: "content" | "file";
		file?: TFile;
		tag: string;
		input: LonelogApiPartylogTagInput;
	};
	"partylog-tag-mutated": {
		target: "content" | "file";
		file?: TFile;
		tag: string;
		action: "upsert-goal" | "upsert-quest" | "upsert-faction" | "upsert-thread" | "upsert-party";
	};
	"resources-inventory-mutated": {
		target: "content" | "file";
		file?: TFile;
		tag: string;
		action: "set" | "delta" | "properties" | "move";
	};
	"combat-encounter-created": {
		target: "content" | "file";
		file?: TFile;
		block: string;
	};
	"combat-combatant-added": {
		target: "content" | "file";
		file?: TFile;
		tag: string;
	};
	"combat-combatant-updated": {
		target: "content" | "file";
		file?: TFile;
		tag: string;
	};
	"combat-combatant-removed": {
		target: "content" | "file";
		file?: TFile;
		name: string;
	};
	"combat-round-advanced": {
		target: "content" | "file";
		file?: TFile;
		roundLine: string;
	};
	"combat-encounter-closed": {
		target: "content" | "file";
		file?: TFile;
		block: string;
	};
}

export interface LonelogApi {
	apiVersion: typeof LONELOG_API_VERSION;
	capabilities: {
		get(): LonelogApiCapabilities;
	};
	adapters: {
		content(content: string): LonelogApiAdapterSnapshot;
		file(file: TFile): Promise<LonelogApiFileAdapterSnapshot>;
		activeFile(): Promise<LonelogApiFileAdapterSnapshot | null>;
	};
	json: {
		lonelog: {
			content(content: string): LonelogApiLonelogJsonDocument;
			file(file: TFile): Promise<LonelogApiLonelogJsonDocument>;
		};
		partylog: {
			content(content: string): LonelogApiPartylogJsonDocument;
			file(file: TFile): Promise<LonelogApiPartylogJsonDocument>;
		};
		dungeon: {
			content(content: string): LonelogApiDungeonJsonDocument;
			file(file: TFile): Promise<LonelogApiDungeonJsonDocument>;
		};
		resources: {
			content(content: string): LonelogApiResourcesJsonDocument;
			file(file: TFile): Promise<LonelogApiResourcesJsonDocument>;
		};
		combat: {
			content(content: string): LonelogApiCombatJsonDocument;
			file(file: TFile): Promise<LonelogApiCombatJsonDocument>;
		};
		progress: {
			content(content: string): LonelogApiProgressJsonDocument;
			file(file: TFile): Promise<LonelogApiProgressJsonDocument>;
		};
	};
	addons: {
		getStatus(): LonelogApiAddonStatus;
	};
	dungeon: {
		parseContent(content: string): ParsedElements["rooms"];
		parseFile(file: TFile): Promise<ParsedElements["rooms"]>;
		listRooms(content: string): ParsedRoom[];
		getRoom(content: string, id: string): ParsedRoom | null;
		getLatestRoom(content: string, id?: string): ParsedRoom | null;
		isEnabled(): boolean;
		openView(): Promise<void>;
		serialize: {
			roomTag(input: LonelogApiRoomTagInput): string;
		};
		mutate: {
			upsertRoomInContent(content: string, input: LonelogApiRoomTagInput): LonelogApiMutationResult<string>;
			upsertRoomInFile(file: TFile, input: LonelogApiRoomTagInput): Promise<LonelogApiMutationResult<string>>;
			addStatusInContent(content: string, roomId: string, status: string): LonelogApiMutationResult<string>;
			addStatusInFile(file: TFile, roomId: string, status: string): Promise<LonelogApiMutationResult<string>>;
			removeStatusInContent(content: string, roomId: string, status: string): LonelogApiMutationResult<string>;
			removeStatusInFile(file: TFile, roomId: string, status: string): Promise<LonelogApiMutationResult<string>>;
			addExitInContent(content: string, roomId: string, exit: string): LonelogApiMutationResult<string>;
			addExitInFile(file: TFile, roomId: string, exit: string): Promise<LonelogApiMutationResult<string>>;
			removeExitInContent(content: string, roomId: string, exit: string): LonelogApiMutationResult<string>;
			removeExitInFile(file: TFile, roomId: string, exit: string): Promise<LonelogApiMutationResult<string>>;
		};
	};
	resources: {
		parseContent(content: string): {
			inventory: ParsedElements["inventory"];
			wealth: ParsedElements["wealth"];
		};
		parseFile(file: TFile): Promise<{
			inventory: ParsedElements["inventory"];
			wealth: ParsedElements["wealth"];
		}>;
		listInventory(content: string): ParsedItem[];
		getInventoryItem(content: string, name: string): ParsedItem | null;
		listWealth(content: string): Array<{ currency: string; amount: string }>;
		isEnabled(): boolean;
		openView(): Promise<void>;
		serialize: {
			inventoryTag(input: LonelogApiInventoryTagInput): string;
			wealthTag(input: LonelogApiWealthTagInput): string;
			inventoryDeltaTag(input: LonelogApiInventoryDeltaInput): string;
			inventoryPropertyTag(input: LonelogApiInventoryPropertyMutationInput): string;
		};
		mutate: {
			appendInventoryToContent(content: string, input: LonelogApiInventoryTagInput): LonelogApiMutationResult<string>;
			appendInventoryToFile(file: TFile, input: LonelogApiInventoryTagInput): Promise<LonelogApiMutationResult<string>>;
			setInventoryItemInContent(content: string, input: LonelogApiInventoryTagInput): LonelogApiMutationResult<string>;
			setInventoryItemInFile(file: TFile, input: LonelogApiInventoryTagInput): Promise<LonelogApiMutationResult<string>>;
			adjustInventoryItemInContent(content: string, input: LonelogApiInventoryDeltaInput): LonelogApiMutationResult<string>;
			adjustInventoryItemInFile(file: TFile, input: LonelogApiInventoryDeltaInput): Promise<LonelogApiMutationResult<string>>;
			updateInventoryPropertiesInContent(content: string, input: LonelogApiInventoryPropertyMutationInput): LonelogApiMutationResult<string>;
			updateInventoryPropertiesInFile(file: TFile, input: LonelogApiInventoryPropertyMutationInput): Promise<LonelogApiMutationResult<string>>;
			moveInventoryItemInContent(content: string, input: LonelogApiInventoryMoveInput): LonelogApiMutationResult<string>;
			moveInventoryItemInFile(file: TFile, input: LonelogApiInventoryMoveInput): Promise<LonelogApiMutationResult<string>>;
			upsertWealthInContent(content: string, input: LonelogApiWealthCurrencyInput): LonelogApiMutationResult<string>;
			upsertWealthInFile(file: TFile, input: LonelogApiWealthCurrencyInput): Promise<LonelogApiMutationResult<string>>;
		};
	};
	combat: {
		parseContent(content: string): ParsedElements["combat"];
		parseFile(file: TFile): Promise<ParsedElements["combat"]>;
		listEncounters(content: string): ParsedElements["combat"];
		getEncounter(content: string, id: string): ParsedElements["combat"][number] | null;
		getLatestEncounter(content: string): ParsedElements["combat"][number] | null;
		openView(): Promise<void>;
		serialize: {
			encounterBlock(): string;
			combatantTag(input: LonelogApiCombatantInput): string;
			roundLine(round: number): string;
			closeBlock(): string;
		};
		mutate: {
			createEncounterInContent(content: string): LonelogApiMutationResult<string>;
			createEncounterInFile(file: TFile): Promise<LonelogApiMutationResult<string>>;
			addCombatantInContent(content: string, input: LonelogApiCombatantInput): LonelogApiMutationResult<string>;
			addCombatantInFile(file: TFile, input: LonelogApiCombatantInput): Promise<LonelogApiMutationResult<string>>;
			addCombatantToEncounterInContent(content: string, encounterId: string, input: LonelogApiCombatantInput): LonelogApiMutationResult<string>;
			addCombatantToEncounterInFile(file: TFile, encounterId: string, input: LonelogApiCombatantInput): Promise<LonelogApiMutationResult<string>>;
			updateCombatantInContent(content: string, encounterId: string, input: LonelogApiCombatantUpdateInput): LonelogApiMutationResult<string>;
			updateCombatantInFile(file: TFile, encounterId: string, input: LonelogApiCombatantUpdateInput): Promise<LonelogApiMutationResult<string>>;
			removeCombatantInContent(content: string, encounterId: string, name: string): LonelogApiMutationResult<string>;
			removeCombatantInFile(file: TFile, encounterId: string, name: string): Promise<LonelogApiMutationResult<string>>;
			advanceRoundInContent(content: string, round: number): LonelogApiMutationResult<string>;
			advanceRoundInFile(file: TFile, round: number): Promise<LonelogApiMutationResult<string>>;
			advanceRoundInEncounterInContent(content: string, encounterId: string, round: number): LonelogApiMutationResult<string>;
			advanceRoundInEncounterInFile(file: TFile, encounterId: string, round: number): Promise<LonelogApiMutationResult<string>>;
			closeEncounterInContent(content: string): LonelogApiMutationResult<string>;
			closeEncounterInFile(file: TFile): Promise<LonelogApiMutationResult<string>>;
			closeEncounterByIdInContent(content: string, encounterId: string): LonelogApiMutationResult<string>;
			closeEncounterByIdInFile(file: TFile, encounterId: string): Promise<LonelogApiMutationResult<string>>;
		};
	};
	progress: {
		parseContent(content: string): ParsedElements["progress"];
		parseFile(file: TFile): Promise<ParsedElements["progress"]>;
		list(content: string): ParsedProgress[];
		get(content: string, name: string, kind?: ParsedProgress["type"]): ParsedProgress | null;
		getLatestTrack(content: string, name?: string): ParsedProgress | null;
		openView(): Promise<void>;
		serialize: {
			tag(input: LonelogApiProgressTagInput): string;
		};
		mutate: {
			upsertInContent(content: string, input: LonelogApiProgressTagInput): LonelogApiMutationResult<string>;
			upsertInFile(file: TFile, input: LonelogApiProgressTagInput): Promise<LonelogApiMutationResult<string>>;
		};
	};
	partylog: {
		parseContent(content: string): PartylogParsedDocument;
		parseFile(file: TFile): Promise<PartylogParsedDocument>;
		hasBlocks(target: TFile | string): Promise<boolean>;
		getLatestBlockIndex(content: string): number | null;
		getOpenThreads(content: string): Array<{ name: string; state: string }>;
		getActiveGoals(content: string): Array<{ name: string; state: string; type: "goal" | "quest" }>;
		getPartyResource(content: string, key: string): { key: string; value: string } | null;
		isEnabled(): boolean;
		openView(): Promise<void>;
		serialize: {
			entry(input: LonelogApiPartylogEntryInput): string;
			tag(input: LonelogApiPartylogTagInput): string;
		};
		mutate: {
			appendEntryToContent(content: string, input: LonelogApiPartylogEntryInput): LonelogApiMutationResult<string>;
			appendEntryToFile(file: TFile, input: LonelogApiPartylogEntryInput): Promise<LonelogApiMutationResult<string>>;
			appendEntryToBlockInContent(content: string, blockIndex: number, input: LonelogApiPartylogEntryInput): LonelogApiMutationResult<string>;
			appendEntryToBlockInFile(file: TFile, blockIndex: number, input: LonelogApiPartylogEntryInput): Promise<LonelogApiMutationResult<string>>;
			appendTagToContent(content: string, input: LonelogApiPartylogTagInput): LonelogApiMutationResult<string>;
			appendTagToFile(file: TFile, input: LonelogApiPartylogTagInput): Promise<LonelogApiMutationResult<string>>;
			appendTagToBlockInContent(content: string, blockIndex: number, input: LonelogApiPartylogTagInput): LonelogApiMutationResult<string>;
			appendTagToBlockInFile(file: TFile, blockIndex: number, input: LonelogApiPartylogTagInput): Promise<LonelogApiMutationResult<string>>;
			upsertGoalInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string>;
			upsertGoalInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>>;
			upsertQuestInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string>;
			upsertQuestInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>>;
			upsertFactionInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string>;
			upsertFactionInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>>;
			upsertThreadInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string>;
			upsertThreadInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>>;
			upsertPartyInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string>;
			upsertPartyInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>>;
		};
	};
	info: {
		get(): LonelogApiInfo;
		getModules(): Record<string, LonelogApiModuleInfo>;
		getStabilityPolicy(): LonelogApiStabilityPolicy;
	};
	errors: {
		codes: typeof LONELOG_API_ERROR_CODES;
		isLonelogApiError(error: unknown): error is LonelogApiError;
	};
	events: {
		on<K extends keyof LonelogApiEventMap>(
			name: K,
			callback: (payload: LonelogApiEventMap[K]) => unknown
		): LonelogApiEventRef;
		off<K extends keyof LonelogApiEventMap>(
			name: K,
			callback: (payload: LonelogApiEventMap[K]) => unknown
		): void;
		offref(ref: LonelogApiEventRef): void;
	};
	parse: {
		content(content: string): ParsedElements;
		file(file: TFile): Promise<ParsedElements>;
		isLonelogNote(target: TFile | string): Promise<boolean>;
		partylog: {
			content(content: string): PartylogParsedDocument;
			file(file: TFile): Promise<PartylogParsedDocument>;
			hasBlocks(target: TFile | string): Promise<boolean>;
		};
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

export interface LonelogApiCapabilities {
	apiVersion: typeof LONELOG_API_VERSION;
	adapters: {
		content: true;
		file: true;
		activeFile: true;
	};
	addons: {
		getStatus: true;
		dungeon: true;
		resources: true;
		combat: true;
		progress: true;
		partylog: true;
	};
	errors: {
		lonelogApiError: true;
		fileReadFailed: true;
		fileWriteFailed: true;
		invalidFileType: true;
		invalidInput: true;
	};
	info: {
		get: true;
		getModules: true;
		getStabilityPolicy: true;
	};
	events: {
		settingsChanged: true;
		noteChanged: true;
		viewOpened: true;
		progressMutated: true;
		resourcesInventoryAppended: true;
		resourcesWealthUpserted: true;
		dungeonRoomUpserted: true;
		partylogEntryAppended: true;
		partylogTagAppended: true;
		partylogTagMutated: true;
		resourcesInventoryMutated: true;
		combatEncounterCreated: true;
		combatCombatantAdded: true;
		combatCombatantUpdated: true;
		combatCombatantRemoved: true;
		combatRoundAdvanced: true;
		combatEncounterClosed: true;
	};
	json: {
		lonelog: true;
		partylog: true;
		dungeon: true;
		resources: true;
		combat: true;
		progress: true;
	};
	parsers: {
		lonelog: true;
		partylog: true;
	};
	tokenize: {
		line: true;
		lines: true;
	};
	settings: {
		get: true;
	};
	views: {
		dashboard: true;
		progressTracker: true;
		threadBrowser: true;
		sceneNavigator: true;
		combatTracker: true;
		dungeonStatus: true;
		resources: true;
		partylogDashboard: true;
		viewSelector: true;
	};
}

export interface LonelogApiAddonStatus {
	dungeon: boolean;
	resources: boolean;
	partylog: boolean;
}

export interface LonelogApiLonelogJsonDocument {
	npcs: ParsedElements["npcs"] extends Map<unknown, infer TValue> ? TValue[] : never;
	locations: ParsedElements["locations"] extends Map<unknown, infer TValue> ? TValue[] : never;
	threads: ParsedElements["threads"] extends Map<unknown, infer TValue> ? TValue[] : never;
	pcs: ParsedElements["pcs"] extends Map<unknown, infer TValue> ? TValue[] : never;
	rooms: ParsedElements["rooms"] extends Map<unknown, infer TValue> ? TValue[] : never;
	inventory: ParsedElements["inventory"] extends Map<unknown, infer TValue> ? TValue[] : never;
	wealth: Array<{ currency: string; amount: string }>;
	progress: ParsedProgress[];
	sessions: ParsedElements["sessions"];
	combat: Array<{
		id: string;
		startLine: number;
		endLine?: number;
		currentRound: number;
		combatants: Array<{
			name: string;
			type: "pc" | "foe";
			stats: string[];
			line: number;
		}>;
		isClosed: boolean;
	}>;
}

export interface LonelogApiPartylogJsonDocument {
	hasPartylogBlocks: boolean;
	blockCount: number;
	sessions: PartylogParsedDocument["sessions"];
	pcs: PartylogParsedDocument["pcs"] extends Map<unknown, infer TValue> ? TValue[] : never;
	npcs: PartylogParsedDocument["npcs"] extends Map<unknown, infer TValue> ? TValue[] : never;
	locations: PartylogParsedDocument["locations"] extends Map<unknown, infer TValue> ? TValue[] : never;
	threads: PartylogParsedDocument["threads"] extends Map<unknown, infer TValue> ? TValue[] : never;
	rooms: PartylogParsedDocument["rooms"] extends Map<unknown, infer TValue> ? TValue[] : never;
	inventory: PartylogParsedDocument["inventory"] extends Map<unknown, infer TValue> ? TValue[] : never;
	wealth: Array<{ currency: string; amount: string }>;
	progress: PartylogParsedDocument["progress"];
	combat: LonelogApiLonelogJsonDocument["combat"];
	timeline: PartylogParsedDocument["timeline"];
	roster: PartylogParsedDocument["roster"] extends Map<unknown, infer TValue> ? TValue[] : never;
	partyResources: PartylogParsedDocument["partyResources"] extends Map<unknown, infer TValue> ? TValue[] : never;
	factions: PartylogParsedDocument["factions"] extends Map<unknown, infer TValue> ? TValue[] : never;
	goals: PartylogParsedDocument["goals"] extends Map<unknown, infer TValue> ? TValue[] : never;
	quests: PartylogParsedDocument["quests"] extends Map<unknown, infer TValue> ? TValue[] : never;
	loot: PartylogParsedDocument["loot"] extends Map<unknown, infer TValue> ? TValue[] : never;
	advancements: PartylogParsedDocument["advancements"];
	ooc: PartylogParsedDocument["ooc"];
	dialogue: PartylogParsedDocument["dialogue"];
	meta: PartylogParsedDocument["meta"];
	narrativeBlocks: PartylogParsedDocument["narrativeBlocks"];
	campaignHeader: PartylogParsedDocument["campaignHeader"];
	tables: Array<{ name: string; definition: unknown }>;
	generatorBlocks: PartylogParsedDocument["generatorBlocks"];
	sessionEnds: PartylogParsedDocument["sessionEnds"];
	interludes: PartylogParsedDocument["interludes"];
	authorityWarnings: PartylogParsedDocument["authorityWarnings"];
}

export interface LonelogApiDungeonJsonDocument {
	rooms: ParsedRoom[];
}

export interface LonelogApiResourcesJsonDocument {
	inventory: ParsedItem[];
	wealth: Array<{ currency: string; amount: string }>;
}

export interface LonelogApiCombatJsonDocument {
	encounters: LonelogApiLonelogJsonDocument["combat"];
}

export interface LonelogApiProgressJsonDocument {
	progress: ParsedProgress[];
}

export interface LonelogApiAdapterSnapshot {
	isLonelogNote: boolean;
	hasPartylogBlocks: boolean;
	lonelog: LonelogApiLonelogJsonDocument;
	partylog: LonelogApiPartylogJsonDocument;
	dungeon: LonelogApiDungeonJsonDocument;
	resources: LonelogApiResourcesJsonDocument;
	combat: LonelogApiCombatJsonDocument;
	progress: LonelogApiProgressJsonDocument;
}

export interface LonelogApiFileAdapterSnapshot extends LonelogApiAdapterSnapshot {
	file: TFile;
}

export interface LonelogApiMutationResult<TValue> {
	content: string;
	value: TValue;
	updated: boolean;
	inserted: boolean;
}

export interface LonelogApiInventoryTagInput {
	name: string;
	quantity?: string | number;
	properties?: string[];
	slotParent?: string;
}

export interface LonelogApiInventoryDeltaInput {
	name: string;
	delta: number;
}

export interface LonelogApiInventoryPropertyMutationInput {
	name: string;
	add?: string[];
	remove?: string[];
	replace?: Array<{ from: string; to: string }>;
}

export interface LonelogApiInventoryMoveInput {
	name: string;
	fromSlot: string;
	toSlot: string;
	quantity?: number;
	properties?: string[];
}

export interface LonelogApiWealthTagInput {
	currencies: Record<string, string | number>;
}

export interface LonelogApiWealthCurrencyInput {
	currency: string;
	amount: string | number;
}

export interface LonelogApiProgressTagInput {
	kind: "clock" | "event" | "track" | "timer";
	name: string;
	current: number;
	max?: number;
}

export interface LonelogApiRoomTagInput {
	id: string;
	status?: string[];
	description?: string;
	exits?: string[];
}

export interface LonelogApiCombatantInput {
	type: "pc" | "foe";
	name: string;
	stats?: string[];
}

export interface LonelogApiCombatantUpdateInput {
	name: string;
	type?: "pc" | "foe";
	stats?: string[];
}

export interface LonelogApiPartylogEntryInput {
	type: "action" | "world-event" | "question" | "consequence" | "dialogue";
	text: string;
	actor?: string;
	speakerType?: string;
}

export interface LonelogApiPartylogTagInput {
	type: "party" | "faction" | "goal" | "quest" | "loot" | "advance" | "ooc" | "thread";
	name?: string;
	state?: string;
	tags?: string[];
	tier?: string;
	standing?: string;
	summary?: string;
	gains?: string[];
	label?: string;
	details?: string[];
	active?: boolean;
	entries?: string[];
}

export type LonelogApiErrorCode =
	typeof LONELOG_API_ERROR_CODES[keyof typeof LONELOG_API_ERROR_CODES];

export class LonelogApiError extends Error {
	override name = "LonelogApiError";
	code: LonelogApiErrorCode;
	cause?: unknown;

	constructor(code: LonelogApiErrorCode, message: string, cause?: unknown) {
		super(message);
		this.code = code;
		this.cause = cause;
	}
}

class LonelogApiEvents {
	private nextId = 1;
	private listeners = new Map<keyof LonelogApiEventMap, Map<number, (payload: unknown) => unknown>>();

	on<K extends keyof LonelogApiEventMap>(
		name: K,
		callback: (payload: LonelogApiEventMap[K]) => unknown
	): LonelogApiEventRef {
		const id = this.nextId++;
		const listeners = this.listeners.get(name) ?? new Map<number, (payload: unknown) => unknown>();
		listeners.set(id, callback as (payload: unknown) => unknown);
		this.listeners.set(name, listeners);
		return { name, id };
	}

	off<K extends keyof LonelogApiEventMap>(
		name: K,
		callback: (payload: LonelogApiEventMap[K]) => unknown
	): void {
		const listeners = this.listeners.get(name);
		if (!listeners) return;

		for (const [id, registered] of listeners.entries()) {
			if (registered === (callback as (payload: unknown) => unknown)) {
				listeners.delete(id);
			}
		}
	}

	offref(ref: LonelogApiEventRef): void {
		this.listeners.get(ref.name)?.delete(ref.id);
	}

	trigger<K extends keyof LonelogApiEventMap>(name: K, payload: LonelogApiEventMap[K]): void {
		const listeners = this.listeners.get(name);
		if (!listeners) return;

		for (const callback of listeners.values()) {
			callback(payload);
		}
	}
}

function hasLonelogFrontmatter(frontmatter: FrontmatterLike): boolean {
	if (!frontmatter) return false;
	return FRONTMATTER_KEYS.some((key) => frontmatter[key] !== undefined);
}

export function isLonelogContent(content: string): boolean {
	return BLOCK_MARKER_RE.test(content) || TAG_MARKER_RE.test(content) || LINE_MARKER_RE.test(content);
}

export function hasPartylogBlocks(content: string): boolean {
	return /```partylog\b/m.test(content);
}

export function isLonelogApiError(error: unknown): error is LonelogApiError {
	return error instanceof LonelogApiError;
}

function assertMarkdownFile(file: TFile): void {
	if (file.extension !== "md") {
		throw new LonelogApiError(
			LONELOG_API_ERROR_CODES.INVALID_FILE_TYPE,
			`Expected a markdown file, received ".${file.extension}".`
		);
	}
}

function cloneSettings(settings: LonelogSettings): Readonly<LonelogSettings> {
	return { ...settings };
}

function getAddonStatus(settings: LonelogSettings): LonelogApiAddonStatus {
	return {
		dungeon: settings.enableDungeonAddon,
		resources: settings.enableResourceAddon,
		partylog: settings.enablePartylogAddon,
	};
}

function getModuleInfo(): Record<string, LonelogApiModuleInfo> {
	return {
		addons: { name: "addons", version: "1", stability: "stable", deprecated: false, replacement: null },
		adapters: { name: "adapters", version: "1", stability: "stable", deprecated: false, replacement: null },
		dungeon: { name: "dungeon", version: "1", stability: "stable", deprecated: false, replacement: null },
		resources: { name: "resources", version: "1", stability: "stable", deprecated: false, replacement: null },
		combat: { name: "combat", version: "1", stability: "stable", deprecated: false, replacement: null },
		progress: { name: "progress", version: "1", stability: "stable", deprecated: false, replacement: null },
		partylog: { name: "partylog", version: "1", stability: "stable", deprecated: false, replacement: null },
		info: { name: "info", version: "1", stability: "stable", deprecated: false, replacement: null },
		capabilities: { name: "capabilities", version: "1", stability: "stable", deprecated: false, replacement: null },
		errors: { name: "errors", version: "1", stability: "stable", deprecated: false, replacement: null },
		events: { name: "events", version: "1", stability: "stable", deprecated: false, replacement: null },
		parse: { name: "parse", version: "1", stability: "stable", deprecated: false, replacement: null },
		tokenize: { name: "tokenize", version: "1", stability: "stable", deprecated: false, replacement: null },
		settings: { name: "settings", version: "1", stability: "stable", deprecated: false, replacement: null },
		views: { name: "views", version: "1", stability: "stable", deprecated: false, replacement: null },
	};
}

function getStabilityPolicy(): LonelogApiStabilityPolicy {
	return {
		apiVersion: LONELOG_API_VERSION,
		defaultStability: "stable",
		additiveChangesWithinV1: true,
		breakingChangesRequireNewApiVersion: true,
		deprecatedSurfaceRemainsUntilNextApiVersion: true,
	};
}

async function readMarkdownFile(host: LonelogApiHost, file: TFile): Promise<string> {
	assertMarkdownFile(file);

	try {
		return await host.app.vault.read(file);
	} catch (error) {
		throw new LonelogApiError(
			LONELOG_API_ERROR_CODES.FILE_READ_FAILED,
			`Failed to read markdown file "${file.path ?? file.name ?? "unknown"}".`,
			error
		);
	}
}

async function writeMarkdownFile(host: LonelogApiHost, file: TFile, content: string): Promise<void> {
	assertMarkdownFile(file);

	try {
		await host.app.vault.modify(file, content);
	} catch (error) {
		throw new LonelogApiError(
			LONELOG_API_ERROR_CODES.FILE_WRITE_FAILED,
			`Failed to write markdown file "${file.path ?? file.name ?? "unknown"}".`,
			error
		);
	}
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendLine(content: string, line: string): string {
	if (!content.trim()) return line;
	return content.endsWith("\n") ? `${content}${line}` : `${content}\n${line}`;
}

function findLastMatch(content: string, regex: RegExp): RegExpExecArray | null {
	regex.lastIndex = 0;
	let lastMatch: RegExpExecArray | null = null;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(content)) !== null) {
		lastMatch = match;
	}
	return lastMatch;
}

function serializeProgressTag(input: LonelogApiProgressTagInput): string {
	switch (input.kind) {
		case "timer":
			return `[Timer:${input.name} ${input.current}]`;
		case "event":
			if (input.max === undefined) {
				throw new LonelogApiError(
					LONELOG_API_ERROR_CODES.INVALID_INPUT,
					"Event clocks require a max value."
				);
			}
			return `[E:${input.name} ${input.current}/${input.max}]`;
		case "track":
			if (input.max === undefined) {
				throw new LonelogApiError(
					LONELOG_API_ERROR_CODES.INVALID_INPUT,
					"Tracks require a max value."
				);
			}
			return `[Track:${input.name} ${input.current}/${input.max}]`;
		case "clock":
			if (input.max === undefined) {
				throw new LonelogApiError(
					LONELOG_API_ERROR_CODES.INVALID_INPUT,
					"Clocks require a max value."
				);
			}
			return `[Clock:${input.name} ${input.current}/${input.max}]`;
	}
}

function upsertProgressInContent(content: string, input: LonelogApiProgressTagInput): LonelogApiMutationResult<string> {
	const tag = serializeProgressTag(input);
	let regex: RegExp;

	switch (input.kind) {
		case "timer":
			regex = new RegExp(`\\[Timer:${escapeRegex(input.name)}\\s+\\d+(?:\\s*->\\s*\\d+)?\\]`, "g");
			break;
		case "event":
			regex = new RegExp(`\\[E:${escapeRegex(input.name)}\\s+\\d+(?:\\.\\d+)?\\/\\d+(?:\\.\\d+)?(?:\\s*->\\s*\\d+(?:\\.\\d+)?\\/\\d+(?:\\.\\d+)?)?\\]`, "g");
			break;
		case "track":
			regex = new RegExp(`\\[Track:${escapeRegex(input.name)}\\s+\\d+(?:\\.\\d+)?\\/\\d+(?:\\.\\d+)?(?:\\s*->\\s*\\d+(?:\\.\\d+)?\\/\\d+(?:\\.\\d+)?)?\\]`, "g");
			break;
		case "clock":
			regex = new RegExp(`\\[Clock:${escapeRegex(input.name)}\\s+\\d+(?:\\.\\d+)?\\/\\d+(?:\\.\\d+)?(?:\\s*->\\s*\\d+(?:\\.\\d+)?\\/\\d+(?:\\.\\d+)?)?\\]`, "g");
			break;
	}

	const lastMatch = findLastMatch(content, regex);
	if (!lastMatch) {
		return {
			content: appendLine(content, tag),
			value: tag,
			updated: false,
			inserted: true,
		};
	}

	const nextContent = `${content.slice(0, lastMatch.index)}${tag}${content.slice(lastMatch.index + lastMatch[0].length)}`;
	return {
		content: nextContent,
		value: tag,
		updated: true,
		inserted: false,
	};
}

function serializeInventoryTag(input: LonelogApiInventoryTagInput): string {
	if (input.slotParent) {
		const slotQuantity = input.quantity === undefined ? "" : Number(input.quantity) > 1 ? `×${String(input.quantity)}` : "";
		const slotItem = `${input.name}${slotQuantity}`;
		const parts = [`[Inv:${input.slotParent}|${slotItem}`];
		for (const property of input.properties ?? []) parts.push(`|${property}`);
		parts.push("]");
		return parts.join("");
	}

	const parts = [`[Inv:${input.name}`];
	if (input.quantity !== undefined) parts.push(`|${String(input.quantity)}`);
	for (const property of input.properties ?? []) parts.push(`|${property}`);
	parts.push("]");
	return parts.join("");
}

function serializeInventoryDeltaTag(input: LonelogApiInventoryDeltaInput): string {
	const signedDelta = input.delta >= 0 ? `+${input.delta}` : `${input.delta}`;
	return `[Inv:${input.name}${signedDelta}]`;
}

function serializeInventoryPropertyTag(input: LonelogApiInventoryPropertyMutationInput): string {
	const mutations = [
		...(input.add ?? []).map((value) => `+${value}`),
		...(input.remove ?? []).map((value) => `-${value}`),
		...(input.replace ?? []).map((value) => `${value.from}->${value.to}`),
	];
	return `[Inv:${input.name}||${mutations.join("|")}]`;
}

function currenciesToRecord(currencies: Map<string, string>): Record<string, string> {
	const entries = Array.from(currencies.entries()).map(([currency, amount]) => [currency, amount] as const);
	return Object.fromEntries(entries) as Record<string, string>;
}

function serializeWealthTag(input: LonelogApiWealthTagInput): string {
	const currencyEntries: Array<[string, string | number]> = Object.entries(input.currencies);
	const entries = currencyEntries.map(([currency, amount]) => `${currency} ${String(amount)}`);
	return `[Wealth:${entries.join("|")}]`;
}

function upsertWealthInContent(content: string, input: LonelogApiWealthCurrencyInput): LonelogApiMutationResult<string> {
	const wealthRegex = /\[#?Wealth:[^\]]+\]/g;
	const lastMatch = findLastMatch(content, wealthRegex);
	const parsed = NotationParser.parse(content);
	const nextWealth = new Map(parsed.wealth);
	nextWealth.set(input.currency, String(input.amount));

	const tag = serializeWealthTag({
		currencies: currenciesToRecord(nextWealth),
	});

	if (!lastMatch) {
		return {
			content: appendLine(content, tag),
			value: tag,
			updated: false,
			inserted: true,
		};
	}

	const nextContent = `${content.slice(0, lastMatch.index)}${tag}${content.slice(lastMatch.index + lastMatch[0].length)}`;
	return {
		content: nextContent,
		value: tag,
		updated: true,
		inserted: false,
	};
}

function mapValuesToArray<TValue>(map: Map<string, TValue>): TValue[] {
	return Array.from(map.values());
}

function mapEntriesToKeyValueArray(map: Map<string, string>): Array<{ currency: string; amount: string }> {
	return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
}

function serializeCombatEncounters(encounters: ParsedElements["combat"]): LonelogApiLonelogJsonDocument["combat"] {
	return encounters.map((encounter) => ({
		id: encounter.id,
		startLine: encounter.startLine,
		endLine: encounter.endLine,
		currentRound: encounter.currentRound,
		combatants: Array.from(encounter.combatants.values()),
		isClosed: encounter.isClosed,
	}));
}

function toLonelogJson(parsed: ParsedElements): LonelogApiLonelogJsonDocument {
	return {
		npcs: mapValuesToArray(parsed.npcs),
		locations: mapValuesToArray(parsed.locations),
		threads: mapValuesToArray(parsed.threads),
		pcs: mapValuesToArray(parsed.pcs),
		rooms: mapValuesToArray(parsed.rooms),
		inventory: mapValuesToArray(parsed.inventory),
		wealth: mapEntriesToKeyValueArray(parsed.wealth),
		progress: parsed.progress,
		sessions: parsed.sessions,
		combat: serializeCombatEncounters(parsed.combat),
	};
}

function toPartylogJson(parsed: PartylogParsedDocument): LonelogApiPartylogJsonDocument {
	return {
		hasPartylogBlocks: parsed.hasPartylogBlocks,
		blockCount: parsed.blockCount,
		sessions: parsed.sessions,
		pcs: mapValuesToArray(parsed.pcs),
		npcs: mapValuesToArray(parsed.npcs),
		locations: mapValuesToArray(parsed.locations),
		threads: mapValuesToArray(parsed.threads),
		rooms: mapValuesToArray(parsed.rooms),
		inventory: mapValuesToArray(parsed.inventory),
		wealth: mapEntriesToKeyValueArray(parsed.wealth),
		progress: parsed.progress,
		combat: serializeCombatEncounters(parsed.combat),
		timeline: parsed.timeline,
		roster: mapValuesToArray(parsed.roster),
		partyResources: mapValuesToArray(parsed.partyResources),
		factions: mapValuesToArray(parsed.factions),
		goals: mapValuesToArray(parsed.goals),
		quests: mapValuesToArray(parsed.quests),
		loot: mapValuesToArray(parsed.loot),
		advancements: parsed.advancements,
		ooc: parsed.ooc,
		dialogue: parsed.dialogue,
		meta: parsed.meta,
		narrativeBlocks: parsed.narrativeBlocks,
		campaignHeader: parsed.campaignHeader,
		tables: Array.from(parsed.tables.entries()).map(([name, definition]) => ({ name, definition })),
		generatorBlocks: parsed.generatorBlocks,
		sessionEnds: parsed.sessionEnds,
		interludes: parsed.interludes,
		authorityWarnings: parsed.authorityWarnings,
	};
}

function toDungeonJson(parsed: ParsedElements): LonelogApiDungeonJsonDocument {
	return {
		rooms: mapValuesToArray(parsed.rooms),
	};
}

function toResourcesJson(parsed: ParsedElements): LonelogApiResourcesJsonDocument {
	return {
		inventory: mapValuesToArray(parsed.inventory),
		wealth: mapEntriesToKeyValueArray(parsed.wealth),
	};
}

function toCombatJson(parsed: ParsedElements): LonelogApiCombatJsonDocument {
	return {
		encounters: serializeCombatEncounters(parsed.combat),
	};
}

function toProgressJson(parsed: ParsedElements): LonelogApiProgressJsonDocument {
	return {
		progress: parsed.progress,
	};
}

function toAdapterSnapshot(content: string): LonelogApiAdapterSnapshot {
	const lonelogParsed = NotationParser.parse(content);
	const partylogParsed = PartylogParser.parse(content);
	return {
		isLonelogNote: isLonelogContent(content),
		hasPartylogBlocks: partylogParsed.hasPartylogBlocks,
		lonelog: toLonelogJson(lonelogParsed),
		partylog: toPartylogJson(partylogParsed),
		dungeon: toDungeonJson(lonelogParsed),
		resources: toResourcesJson(lonelogParsed),
		combat: toCombatJson(lonelogParsed),
		progress: toProgressJson(lonelogParsed),
	};
}

function serializeRoomTag(input: LonelogApiRoomTagInput): string {
	const parts: string[] = [`[R:${input.id}`];
	if (input.status && input.status.length > 0) {
		parts.push(`|${input.status.join(", ")}`);
	}
	if (input.description !== undefined) {
		if (!input.status || input.status.length === 0) parts.push("|");
		parts.push(`|${input.description}`);
	}
	if (input.exits && input.exits.length > 0) {
		if ((!input.status || input.status.length === 0) && input.description === undefined) parts.push("|");
		if (input.description === undefined) parts.push("|");
		parts.push(`|exits ${input.exits.join(", ")}`);
	}
	parts.push("]");
	return parts.join("");
}

function upsertRoomInContent(content: string, input: LonelogApiRoomTagInput): LonelogApiMutationResult<string> {
	const tag = serializeRoomTag(input);
	const regex = new RegExp(`\\[#?R:${escapeRegex(input.id)}(?:\\|[^\\]]*)?\\]`, "g");
	const lastMatch = findLastMatch(content, regex);

	if (!lastMatch) {
		return {
			content: appendLine(content, tag),
			value: tag,
			updated: false,
			inserted: true,
		};
	}

	const nextContent = `${content.slice(0, lastMatch.index)}${tag}${content.slice(lastMatch.index + lastMatch[0].length)}`;
	return {
		content: nextContent,
		value: tag,
		updated: true,
		inserted: false,
	};
}

function updateRoomWith(content: string, roomId: string, updater: (room: ParsedRoom | null) => LonelogApiRoomTagInput): LonelogApiMutationResult<string> {
	const room = NotationParser.parse(content).rooms.get(roomId) ?? null;
	return upsertRoomInContent(content, updater(room));
}

function serializeCombatantTag(input: LonelogApiCombatantInput): string {
	const prefix = input.type === "pc" ? "PC" : "F";
	const stats = input.stats && input.stats.length > 0 ? `|${input.stats.join("|")}` : "";
	return `[${prefix}:${input.name}${stats}]`;
}

function serializeCombatEncounterBlock(): string {
	return "[COMBAT]\n\n[/COMBAT]";
}

function serializeCombatRoundLine(round: number): string {
	return `Rd${round}`;
}

function appendBeforeLastCombatClosing(content: string, line: string): LonelogApiMutationResult<string> {
	const closingRegex = /\[\/COMBAT\]/gi;
	const lastClosing = findLastMatch(content, closingRegex);
	if (!lastClosing) {
		return {
			content: appendLine(content, line),
			value: line,
			updated: false,
			inserted: true,
		};
	}

	const insertion = `${line}\n`;
	const nextContent = `${content.slice(0, lastClosing.index)}${insertion}${content.slice(lastClosing.index)}`;
	return {
		content: nextContent,
		value: line,
		updated: true,
		inserted: false,
	};
}

function splitContentLines(content: string): string[] {
	return content.split("\n");
}

function joinContentLines(lines: string[]): string {
	return lines.join("\n");
}

function getEncounterById(content: string, encounterId?: string): ParsedElements["combat"][number] | null {
	const encounters = NotationParser.parse(content).combat;
	if (encounterId) return encounters.find((encounter) => encounter.id === encounterId) ?? null;
	return encounters.length > 0 ? encounters[encounters.length - 1] ?? null : null;
}

function insertLineInEncounter(content: string, encounterId: string | undefined, line: string): LonelogApiMutationResult<string> {
	const encounter = getEncounterById(content, encounterId);
	if (!encounter) {
		throw new LonelogApiError(LONELOG_API_ERROR_CODES.INVALID_INPUT, "Combat encounter not found.");
	}

	const lines = splitContentLines(content);
	const insertIndex = encounter.endLine ?? lines.length;
	lines.splice(insertIndex, 0, line);
	return {
		content: joinContentLines(lines),
		value: line,
		updated: true,
		inserted: false,
	};
}

function updateCombatantInEncounterContent(
	content: string,
	encounterId: string,
	input: LonelogApiCombatantUpdateInput
): LonelogApiMutationResult<string> {
	const encounter = getEncounterById(content, encounterId);
	const combatant = encounter?.combatants.get(input.name);
	if (!encounter || !combatant) {
		throw new LonelogApiError(LONELOG_API_ERROR_CODES.INVALID_INPUT, `Combatant "${input.name}" not found in encounter.`);
	}

	const nextTag = serializeCombatantTag({
		type: input.type ?? combatant.type,
		name: input.name,
		stats: input.stats ?? combatant.stats,
	});
	const lines = splitContentLines(content);
	const lineIndex = combatant.line;
	lines[lineIndex] = lines[lineIndex]?.replace(/\[(?:PC|F):[^\]]+\]/, nextTag) ?? nextTag;
	return {
		content: joinContentLines(lines),
		value: nextTag,
		updated: true,
		inserted: false,
	};
}

function removeCombatantInEncounterContent(content: string, encounterId: string, name: string): LonelogApiMutationResult<string> {
	const encounter = getEncounterById(content, encounterId);
	const combatant = encounter?.combatants.get(name);
	if (!encounter || !combatant) {
		throw new LonelogApiError(LONELOG_API_ERROR_CODES.INVALID_INPUT, `Combatant "${name}" not found in encounter.`);
	}

	const lines = splitContentLines(content);
	lines.splice(combatant.line, 1);
	return {
		content: joinContentLines(lines),
		value: name,
		updated: true,
		inserted: false,
	};
}

function closeEncounterByIdInContent(content: string, encounterId: string): LonelogApiMutationResult<string> {
	return insertLineInEncounter(content, encounterId, "[/COMBAT]");
}

function getPartylogBlocks(content: string): RegExpExecArray[] {
	const regex = /```partylog\b[\s\S]*?```/g;
	const matches: RegExpExecArray[] = [];
	let match: RegExpExecArray | null;
	while ((match = regex.exec(content)) !== null) {
		matches.push(match);
	}
	return matches;
}

function resolvePartylogBlock(content: string, blockIndex?: number): RegExpExecArray | null {
	const blocks = getPartylogBlocks(content);
	if (blocks.length === 0) return null;
	if (blockIndex === undefined) return blocks[blocks.length - 1] ?? null;
	return blocks[blockIndex] ?? null;
}

function appendRawPartylogLineToBlockContent(content: string, blockIndex: number | undefined, line: string): LonelogApiMutationResult<string> {
	const block = resolvePartylogBlock(content, blockIndex);
	if (!block) {
		const created = `\`\`\`partylog\n${line}\n\`\`\``;
		return {
			content: appendLine(content, created),
			value: line,
			updated: false,
			inserted: true,
		};
	}

	const blockText = block[0];
	const closingFenceIndex = blockText.lastIndexOf("```");
	const beforeFence = blockText.slice(0, closingFenceIndex).replace(/\s*$/, "");
	const updatedBlock = `${beforeFence}\n${line}\n\`\`\``;
	return {
		content: `${content.slice(0, block.index)}${updatedBlock}${content.slice(block.index + blockText.length)}`,
		value: line,
		updated: true,
		inserted: false,
	};
}

function upsertRawPartylogLineInBlockContent(
	content: string,
	blockIndex: number | undefined,
	line: string,
	matcher: RegExp
): LonelogApiMutationResult<string> {
	const block = resolvePartylogBlock(content, blockIndex);
	if (!block) {
		const created = `\`\`\`partylog\n${line}\n\`\`\``;
		return {
			content: appendLine(content, created),
			value: line,
			updated: false,
			inserted: true,
		};
	}

	const blockText = block[0];
	const inner = blockText.replace(/^```partylog\b\s*\n?/, "").replace(/\n?```$/, "");
	const lines = inner.length > 0 ? inner.split("\n") : [];
	let replaced = false;
	for (let index = lines.length - 1; index >= 0; index--) {
		if (matcher.test(lines[index] ?? "")) {
			lines[index] = line;
			replaced = true;
			break;
		}
	}
	if (!replaced) lines.push(line);
	const updatedBlock = `\`\`\`partylog\n${lines.filter(Boolean).join("\n")}\n\`\`\``;
	return {
		content: `${content.slice(0, block.index)}${updatedBlock}${content.slice(block.index + blockText.length)}`,
		value: line,
		updated: replaced,
		inserted: !replaced,
	};
}

function serializePartylogEntry(input: LonelogApiPartylogEntryInput): string {
	switch (input.type) {
		case "action":
			return input.actor ? `@(${input.actor}) ${input.text}` : `@ ${input.text}`;
		case "world-event":
			return `! ${input.text}`;
		case "question":
			return input.actor ? `?(${input.actor}) ${input.text}` : `? ${input.text}`;
		case "consequence":
			return `=> ${input.text}`;
		case "dialogue": {
			const speakerType = input.speakerType ?? "PC";
			return input.actor ? `${speakerType} (${input.actor}): "${input.text}"` : `${speakerType}: "${input.text}"`;
		}
	}
}

function appendPartylogEntryToContent(content: string, input: LonelogApiPartylogEntryInput): LonelogApiMutationResult<string> {
	const entry = serializePartylogEntry(input);
	return appendRawPartylogLineToBlockContent(content, undefined, entry);
}

function appendRawPartylogLineToContent(content: string, line: string): LonelogApiMutationResult<string> {
	return appendRawPartylogLineToBlockContent(content, undefined, line);
}

function serializePartylogTag(input: LonelogApiPartylogTagInput): string {
	switch (input.type) {
		case "party":
			return `[Party:${(input.entries ?? []).join("|")}]`;
		case "faction": {
			const parts = [input.name ?? ""];
			if (input.tier) parts.push(`tier:${input.tier}`);
			if (input.standing) parts.push(`standing:${input.standing}`);
			parts.push(...(input.tags ?? []));
			return `[Faction:${parts.filter(Boolean).join("|")}]`;
		}
		case "goal":
			return `[Goal:${[input.name, input.state].filter(Boolean).join("|")}]`;
		case "quest":
			return `[Quest:${[input.name, input.state].filter(Boolean).join("|")}]`;
		case "loot": {
			const prefix = input.active === false ? "-" : "";
			return `[Loot:${prefix}${[input.name, ...(input.tags ?? [])].filter(Boolean).join("|")}]`;
		}
		case "advance":
			return `[Advance:${[input.name, input.summary, ...(input.gains ?? [])].filter(Boolean).join("|")}]`;
		case "ooc":
			return `[OOC:${[input.label, ...(input.details ?? [])].filter(Boolean).join("|")}]`;
		case "thread":
			return `[Thread:${[input.name, input.state].filter(Boolean).join("|")}]`;
	}
}

interface LonelogApiInternalController {
	emitSettingsChanged(): void;
	emitNoteChanged(file: TFile): Promise<void>;
	emitViewOpened(viewType: string): void;
}

export function createLonelogApi(host: LonelogApiHost): {
	api: LonelogApi;
	internal: LonelogApiInternalController;
} {
	const events = new LonelogApiEvents();

	const internal: LonelogApiInternalController = {
		emitSettingsChanged(): void {
			events.trigger("settings-changed", {
				settings: cloneSettings(host.settings),
			} satisfies LonelogApiEventMap["settings-changed"]);
		},
		async emitNoteChanged(file: TFile): Promise<void> {
			if (file.extension !== "md") return;
			try {
				const content = await readMarkdownFile(host, file);
				events.trigger("note-changed", {
					file,
					isLonelogNote: isLonelogContent(content),
					hasPartylogBlocks: hasPartylogBlocks(content),
				} satisfies LonelogApiEventMap["note-changed"]);
			} catch {
				// Intentionally swallow: note-change hooks should not break the plugin lifecycle.
			}
		},
		emitViewOpened(viewType: string): void {
			events.trigger("view-opened", {
				viewType,
			} satisfies LonelogApiEventMap["view-opened"]);
		},
	};

	const api: LonelogApi = {
		apiVersion: LONELOG_API_VERSION,
		capabilities: {
			get(): LonelogApiCapabilities {
				return {
					apiVersion: LONELOG_API_VERSION,
					adapters: {
						content: true,
						file: true,
						activeFile: true,
					},
					addons: {
						getStatus: true,
						dungeon: true,
						resources: true,
						combat: true,
						progress: true,
						partylog: true,
					},
					errors: {
						lonelogApiError: true,
						fileReadFailed: true,
						fileWriteFailed: true,
						invalidFileType: true,
						invalidInput: true,
					},
					info: {
						get: true,
						getModules: true,
						getStabilityPolicy: true,
					},
					events: {
						settingsChanged: true,
						noteChanged: true,
						viewOpened: true,
						progressMutated: true,
						resourcesInventoryAppended: true,
						resourcesWealthUpserted: true,
						dungeonRoomUpserted: true,
						partylogEntryAppended: true,
						partylogTagAppended: true,
						partylogTagMutated: true,
						resourcesInventoryMutated: true,
						combatEncounterCreated: true,
						combatCombatantAdded: true,
						combatCombatantUpdated: true,
						combatCombatantRemoved: true,
						combatRoundAdvanced: true,
						combatEncounterClosed: true,
					},
					json: {
						lonelog: true,
						partylog: true,
						dungeon: true,
						resources: true,
						combat: true,
						progress: true,
					},
					parsers: {
						lonelog: true,
						partylog: true,
					},
					tokenize: {
						line: true,
						lines: true,
					},
					settings: {
						get: true,
					},
					views: {
						dashboard: true,
						progressTracker: true,
						threadBrowser: true,
						sceneNavigator: true,
						combatTracker: true,
						dungeonStatus: true,
						resources: true,
						partylogDashboard: true,
						viewSelector: true,
					},
				};
			},
		},
		adapters: {
			content(content: string): LonelogApiAdapterSnapshot {
				return toAdapterSnapshot(content);
			},
			async file(file: TFile): Promise<LonelogApiFileAdapterSnapshot> {
				const content = await readMarkdownFile(host, file);
				return {
					file,
					...toAdapterSnapshot(content),
				};
			},
			async activeFile(): Promise<LonelogApiFileAdapterSnapshot | null> {
				const file = host.app.workspace.getActiveFile();
				if (!file) return null;
				return api.adapters.file(file);
			},
		},
		json: {
			lonelog: {
				content(content: string): LonelogApiLonelogJsonDocument {
					return toLonelogJson(NotationParser.parse(content));
				},
				async file(file: TFile): Promise<LonelogApiLonelogJsonDocument> {
					const content = await readMarkdownFile(host, file);
					return toLonelogJson(NotationParser.parse(content));
				},
			},
			partylog: {
				content(content: string): LonelogApiPartylogJsonDocument {
					return toPartylogJson(PartylogParser.parse(content));
				},
				async file(file: TFile): Promise<LonelogApiPartylogJsonDocument> {
					const content = await readMarkdownFile(host, file);
					return toPartylogJson(PartylogParser.parse(content));
				},
			},
			dungeon: {
				content(content: string): LonelogApiDungeonJsonDocument {
					return toDungeonJson(NotationParser.parse(content));
				},
				async file(file: TFile): Promise<LonelogApiDungeonJsonDocument> {
					const content = await readMarkdownFile(host, file);
					return toDungeonJson(NotationParser.parse(content));
				},
			},
			resources: {
				content(content: string): LonelogApiResourcesJsonDocument {
					return toResourcesJson(NotationParser.parse(content));
				},
				async file(file: TFile): Promise<LonelogApiResourcesJsonDocument> {
					const content = await readMarkdownFile(host, file);
					return toResourcesJson(NotationParser.parse(content));
				},
			},
			combat: {
				content(content: string): LonelogApiCombatJsonDocument {
					return toCombatJson(NotationParser.parse(content));
				},
				async file(file: TFile): Promise<LonelogApiCombatJsonDocument> {
					const content = await readMarkdownFile(host, file);
					return toCombatJson(NotationParser.parse(content));
				},
			},
			progress: {
				content(content: string): LonelogApiProgressJsonDocument {
					return toProgressJson(NotationParser.parse(content));
				},
				async file(file: TFile): Promise<LonelogApiProgressJsonDocument> {
					const content = await readMarkdownFile(host, file);
					return toProgressJson(NotationParser.parse(content));
				},
			},
		},
		addons: {
			getStatus(): LonelogApiAddonStatus {
				return getAddonStatus(host.settings);
			},
		},
		dungeon: {
			parseContent(content: string): ParsedElements["rooms"] {
				return NotationParser.parse(content).rooms;
			},
			async parseFile(file: TFile): Promise<ParsedElements["rooms"]> {
				const content = await readMarkdownFile(host, file);
				return NotationParser.parse(content).rooms;
			},
			listRooms(content: string): ParsedRoom[] {
				return mapValuesToArray(NotationParser.parse(content).rooms);
			},
			getRoom(content: string, id: string): ParsedRoom | null {
				return NotationParser.parse(content).rooms.get(id) ?? null;
			},
			getLatestRoom(content: string, id?: string): ParsedRoom | null {
				const rooms = mapValuesToArray(NotationParser.parse(content).rooms);
				if (rooms.length === 0) return null;
				if (id) return NotationParser.parse(content).rooms.get(id) ?? null;
				return rooms.reduce((latest, room) => room.lastMention > latest.lastMention ? room : latest);
			},
			isEnabled(): boolean {
				return host.settings.enableDungeonAddon;
			},
			openView(): Promise<void> {
				return host.activateView(VIEW_TYPES.dungeon);
			},
			serialize: {
				roomTag(input: LonelogApiRoomTagInput): string {
					return serializeRoomTag(input);
				},
			},
			mutate: {
				upsertRoomInContent(content: string, input: LonelogApiRoomTagInput): LonelogApiMutationResult<string> {
					const result = upsertRoomInContent(content, input);
					events.trigger("dungeon-room-upserted", {
						target: "content",
						tag: result.value,
						updated: result.updated,
						inserted: result.inserted,
						input,
					});
					return result;
				},
				async upsertRoomInFile(file: TFile, input: LonelogApiRoomTagInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = upsertRoomInContent(content, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("dungeon-room-upserted", {
						target: "file",
						file,
						tag: result.value,
						updated: result.updated,
						inserted: result.inserted,
						input,
					});
					return result;
				},
				addStatusInContent(content: string, roomId: string, status: string): LonelogApiMutationResult<string> {
					const result = updateRoomWith(content, roomId, (room) => ({
						id: roomId,
						status: room ? Array.from(new Set([...room.status, status])) : [status],
						description: room?.description,
						exits: room?.exits ?? [],
					}));
					events.trigger("dungeon-room-upserted", {
						target: "content",
						tag: result.value,
						updated: result.updated,
						inserted: result.inserted,
						input: {
							id: roomId,
							status: NotationParser.parse(result.content).rooms.get(roomId)?.status ?? [],
							description: NotationParser.parse(result.content).rooms.get(roomId)?.description,
							exits: NotationParser.parse(result.content).rooms.get(roomId)?.exits ?? [],
						},
					});
					return result;
				},
				async addStatusInFile(file: TFile, roomId: string, status: string): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.dungeon.mutate.addStatusInContent(content, roomId, status);
					await writeMarkdownFile(host, file, result.content);
					return result;
				},
				removeStatusInContent(content: string, roomId: string, status: string): LonelogApiMutationResult<string> {
					const result = updateRoomWith(content, roomId, (room) => ({
						id: roomId,
						status: (room?.status ?? []).filter((value) => value !== status),
						description: room?.description,
						exits: room?.exits ?? [],
					}));
					events.trigger("dungeon-room-upserted", {
						target: "content",
						tag: result.value,
						updated: result.updated,
						inserted: result.inserted,
						input: {
							id: roomId,
							status: NotationParser.parse(result.content).rooms.get(roomId)?.status ?? [],
							description: NotationParser.parse(result.content).rooms.get(roomId)?.description,
							exits: NotationParser.parse(result.content).rooms.get(roomId)?.exits ?? [],
						},
					});
					return result;
				},
				async removeStatusInFile(file: TFile, roomId: string, status: string): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.dungeon.mutate.removeStatusInContent(content, roomId, status);
					await writeMarkdownFile(host, file, result.content);
					return result;
				},
				addExitInContent(content: string, roomId: string, exit: string): LonelogApiMutationResult<string> {
					const result = updateRoomWith(content, roomId, (room) => ({
						id: roomId,
						status: room?.status ?? [],
						description: room?.description,
						exits: room ? Array.from(new Set([...room.exits, exit])) : [exit],
					}));
					events.trigger("dungeon-room-upserted", {
						target: "content",
						tag: result.value,
						updated: result.updated,
						inserted: result.inserted,
						input: {
							id: roomId,
							status: NotationParser.parse(result.content).rooms.get(roomId)?.status ?? [],
							description: NotationParser.parse(result.content).rooms.get(roomId)?.description,
							exits: NotationParser.parse(result.content).rooms.get(roomId)?.exits ?? [],
						},
					});
					return result;
				},
				async addExitInFile(file: TFile, roomId: string, exit: string): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.dungeon.mutate.addExitInContent(content, roomId, exit);
					await writeMarkdownFile(host, file, result.content);
					return result;
				},
				removeExitInContent(content: string, roomId: string, exit: string): LonelogApiMutationResult<string> {
					const result = updateRoomWith(content, roomId, (room) => ({
						id: roomId,
						status: room?.status ?? [],
						description: room?.description,
						exits: (room?.exits ?? []).filter((value) => value !== exit),
					}));
					events.trigger("dungeon-room-upserted", {
						target: "content",
						tag: result.value,
						updated: result.updated,
						inserted: result.inserted,
						input: {
							id: roomId,
							status: NotationParser.parse(result.content).rooms.get(roomId)?.status ?? [],
							description: NotationParser.parse(result.content).rooms.get(roomId)?.description,
							exits: NotationParser.parse(result.content).rooms.get(roomId)?.exits ?? [],
						},
					});
					return result;
				},
				async removeExitInFile(file: TFile, roomId: string, exit: string): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.dungeon.mutate.removeExitInContent(content, roomId, exit);
					await writeMarkdownFile(host, file, result.content);
					return result;
				},
			},
		},
		resources: {
			parseContent(content: string): {
				inventory: ParsedElements["inventory"];
				wealth: ParsedElements["wealth"];
			} {
				const parsed = NotationParser.parse(content);
				return {
					inventory: parsed.inventory,
					wealth: parsed.wealth,
				};
			},
			async parseFile(file: TFile): Promise<{
				inventory: ParsedElements["inventory"];
				wealth: ParsedElements["wealth"];
			}> {
				const content = await readMarkdownFile(host, file);
				const parsed = NotationParser.parse(content);
				return {
					inventory: parsed.inventory,
					wealth: parsed.wealth,
				};
			},
			listInventory(content: string): ParsedItem[] {
				return mapValuesToArray(NotationParser.parse(content).inventory);
			},
			getInventoryItem(content: string, name: string): ParsedItem | null {
				return NotationParser.parse(content).inventory.get(name) ?? null;
			},
			listWealth(content: string): Array<{ currency: string; amount: string }> {
				return Array.from(NotationParser.parse(content).wealth.entries()).map(([currency, amount]) => ({
					currency,
					amount,
				}));
			},
			isEnabled(): boolean {
				return host.settings.enableResourceAddon;
			},
			openView(): Promise<void> {
				return host.activateView(VIEW_TYPES.resources);
			},
			serialize: {
				inventoryTag(input: LonelogApiInventoryTagInput): string {
					return serializeInventoryTag(input);
				},
				wealthTag(input: LonelogApiWealthTagInput): string {
					return serializeWealthTag(input);
				},
				inventoryDeltaTag(input: LonelogApiInventoryDeltaInput): string {
					return serializeInventoryDeltaTag(input);
				},
				inventoryPropertyTag(input: LonelogApiInventoryPropertyMutationInput): string {
					return serializeInventoryPropertyTag(input);
				},
			},
			mutate: {
				appendInventoryToContent(content: string, input: LonelogApiInventoryTagInput): LonelogApiMutationResult<string> {
					const tag = serializeInventoryTag(input);
					const result = {
						content: appendLine(content, tag),
						value: tag,
						updated: false,
						inserted: true,
					};
					events.trigger("resources-inventory-appended", {
						target: "content",
						tag,
						input,
					});
					return result;
				},
				async appendInventoryToFile(file: TFile, input: LonelogApiInventoryTagInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const tag = serializeInventoryTag(input);
					const result = {
						content: appendLine(content, tag),
						value: tag,
						updated: false,
						inserted: true,
					};
					await writeMarkdownFile(host, file, result.content);
					events.trigger("resources-inventory-appended", {
						target: "file",
						file,
						tag,
						input,
					});
					return result;
				},
				setInventoryItemInContent(content: string, input: LonelogApiInventoryTagInput): LonelogApiMutationResult<string> {
					const tag = serializeInventoryTag(input);
					const result = {
						content: appendLine(content, tag),
						value: tag,
						updated: false,
						inserted: true,
					};
					events.trigger("resources-inventory-mutated", {
						target: "content",
						tag,
						action: "set",
					});
					return result;
				},
				async setInventoryItemInFile(file: TFile, input: LonelogApiInventoryTagInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.resources.mutate.setInventoryItemInContent(content, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("resources-inventory-mutated", {
						target: "file",
						file,
						tag: result.value,
						action: "set",
					});
					return result;
				},
				adjustInventoryItemInContent(content: string, input: LonelogApiInventoryDeltaInput): LonelogApiMutationResult<string> {
					const tag = serializeInventoryDeltaTag(input);
					const result = {
						content: appendLine(content, tag),
						value: tag,
						updated: false,
						inserted: true,
					};
					events.trigger("resources-inventory-mutated", {
						target: "content",
						tag,
						action: "delta",
					});
					return result;
				},
				async adjustInventoryItemInFile(file: TFile, input: LonelogApiInventoryDeltaInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.resources.mutate.adjustInventoryItemInContent(content, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("resources-inventory-mutated", {
						target: "file",
						file,
						tag: result.value,
						action: "delta",
					});
					return result;
				},
				updateInventoryPropertiesInContent(content: string, input: LonelogApiInventoryPropertyMutationInput): LonelogApiMutationResult<string> {
					const tag = serializeInventoryPropertyTag(input);
					const result = {
						content: appendLine(content, tag),
						value: tag,
						updated: false,
						inserted: true,
					};
					events.trigger("resources-inventory-mutated", {
						target: "content",
						tag,
						action: "properties",
					});
					return result;
				},
				async updateInventoryPropertiesInFile(file: TFile, input: LonelogApiInventoryPropertyMutationInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.resources.mutate.updateInventoryPropertiesInContent(content, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("resources-inventory-mutated", {
						target: "file",
						file,
						tag: result.value,
						action: "properties",
					});
					return result;
				},
				moveInventoryItemInContent(content: string, input: LonelogApiInventoryMoveInput): LonelogApiMutationResult<string> {
					const destinationTag = serializeInventoryTag({
						name: input.name,
						quantity: input.quantity ?? 1,
						properties: input.properties,
						slotParent: input.toSlot,
					});
					const removalTag = `[Inv:${input.fromSlot}|-${input.name}]`;
					const block = `${removalTag}\n${destinationTag}`;
					const result = {
						content: appendLine(content, block),
						value: block,
						updated: false,
						inserted: true,
					};
					events.trigger("resources-inventory-mutated", {
						target: "content",
						tag: block,
						action: "move",
					});
					return result;
				},
				async moveInventoryItemInFile(file: TFile, input: LonelogApiInventoryMoveInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.resources.mutate.moveInventoryItemInContent(content, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("resources-inventory-mutated", {
						target: "file",
						file,
						tag: result.value,
						action: "move",
					});
					return result;
				},
				upsertWealthInContent(content: string, input: LonelogApiWealthCurrencyInput): LonelogApiMutationResult<string> {
					const result = upsertWealthInContent(content, input);
					events.trigger("resources-wealth-upserted", {
						target: "content",
						tag: result.value,
						updated: result.updated,
						inserted: result.inserted,
						input,
					});
					return result;
				},
				async upsertWealthInFile(file: TFile, input: LonelogApiWealthCurrencyInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = upsertWealthInContent(content, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("resources-wealth-upserted", {
						target: "file",
						file,
						tag: result.value,
						updated: result.updated,
						inserted: result.inserted,
						input,
					});
					return result;
				},
			},
		},
		combat: {
			parseContent(content: string): ParsedElements["combat"] {
				return NotationParser.parse(content).combat;
			},
			async parseFile(file: TFile): Promise<ParsedElements["combat"]> {
				const content = await readMarkdownFile(host, file);
				return NotationParser.parse(content).combat;
			},
			listEncounters(content: string): ParsedElements["combat"] {
				return NotationParser.parse(content).combat;
			},
			getEncounter(content: string, id: string): ParsedElements["combat"][number] | null {
				return getEncounterById(content, id);
			},
			getLatestEncounter(content: string): ParsedElements["combat"][number] | null {
				return getEncounterById(content);
			},
			openView(): Promise<void> {
				return host.activateView(VIEW_TYPES.combat);
			},
			serialize: {
				encounterBlock(): string {
					return serializeCombatEncounterBlock();
				},
				combatantTag(input: LonelogApiCombatantInput): string {
					return serializeCombatantTag(input);
				},
				roundLine(round: number): string {
					return serializeCombatRoundLine(round);
				},
				closeBlock(): string {
					return "[/COMBAT]";
				},
			},
			mutate: {
				createEncounterInContent(content: string): LonelogApiMutationResult<string> {
					const block = serializeCombatEncounterBlock();
					const result = {
						content: appendLine(content, block),
						value: block,
						updated: false,
						inserted: true,
					};
					events.trigger("combat-encounter-created", {
						target: "content",
						block,
					});
					return result;
				},
				async createEncounterInFile(file: TFile): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.combat.mutate.createEncounterInContent(content);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("combat-encounter-created", {
						target: "file",
						file,
						block: result.value,
					});
					return result;
				},
				addCombatantInContent(content: string, input: LonelogApiCombatantInput): LonelogApiMutationResult<string> {
					const tag = serializeCombatantTag(input);
					const result = appendBeforeLastCombatClosing(content, tag);
					events.trigger("combat-combatant-added", {
						target: "content",
						tag,
					});
					return result;
				},
				async addCombatantInFile(file: TFile, input: LonelogApiCombatantInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.combat.mutate.addCombatantInContent(content, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("combat-combatant-added", {
						target: "file",
						file,
						tag: result.value,
					});
					return result;
				},
				addCombatantToEncounterInContent(content: string, encounterId: string, input: LonelogApiCombatantInput): LonelogApiMutationResult<string> {
					const tag = serializeCombatantTag(input);
					const result = insertLineInEncounter(content, encounterId, tag);
					events.trigger("combat-combatant-added", { target: "content", tag });
					return result;
				},
				async addCombatantToEncounterInFile(file: TFile, encounterId: string, input: LonelogApiCombatantInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.combat.mutate.addCombatantToEncounterInContent(content, encounterId, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("combat-combatant-added", { target: "file", file, tag: result.value });
					return result;
				},
				updateCombatantInContent(content: string, encounterId: string, input: LonelogApiCombatantUpdateInput): LonelogApiMutationResult<string> {
					const result = updateCombatantInEncounterContent(content, encounterId, input);
					events.trigger("combat-combatant-updated", { target: "content", tag: result.value });
					return result;
				},
				async updateCombatantInFile(file: TFile, encounterId: string, input: LonelogApiCombatantUpdateInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.combat.mutate.updateCombatantInContent(content, encounterId, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("combat-combatant-updated", { target: "file", file, tag: result.value });
					return result;
				},
				removeCombatantInContent(content: string, encounterId: string, name: string): LonelogApiMutationResult<string> {
					const result = removeCombatantInEncounterContent(content, encounterId, name);
					events.trigger("combat-combatant-removed", { target: "content", name });
					return result;
				},
				async removeCombatantInFile(file: TFile, encounterId: string, name: string): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.combat.mutate.removeCombatantInContent(content, encounterId, name);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("combat-combatant-removed", { target: "file", file, name });
					return result;
				},
				advanceRoundInContent(content: string, round: number): LonelogApiMutationResult<string> {
					const roundLine = serializeCombatRoundLine(round);
					const result = appendBeforeLastCombatClosing(content, roundLine);
					events.trigger("combat-round-advanced", {
						target: "content",
						roundLine,
					});
					return result;
				},
				async advanceRoundInFile(file: TFile, round: number): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.combat.mutate.advanceRoundInContent(content, round);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("combat-round-advanced", {
						target: "file",
						file,
						roundLine: result.value,
					});
					return result;
				},
				advanceRoundInEncounterInContent(content: string, encounterId: string, round: number): LonelogApiMutationResult<string> {
					const roundLine = serializeCombatRoundLine(round);
					const result = insertLineInEncounter(content, encounterId, roundLine);
					events.trigger("combat-round-advanced", { target: "content", roundLine });
					return result;
				},
				async advanceRoundInEncounterInFile(file: TFile, encounterId: string, round: number): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.combat.mutate.advanceRoundInEncounterInContent(content, encounterId, round);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("combat-round-advanced", { target: "file", file, roundLine: result.value });
					return result;
				},
				closeEncounterInContent(content: string): LonelogApiMutationResult<string> {
					const block = "[/COMBAT]";
					const result = {
						content: appendLine(content, block),
						value: block,
						updated: false,
						inserted: true,
					};
					events.trigger("combat-encounter-closed", {
						target: "content",
						block,
					});
					return result;
				},
				async closeEncounterInFile(file: TFile): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.combat.mutate.closeEncounterInContent(content);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("combat-encounter-closed", {
						target: "file",
						file,
						block: result.value,
					});
					return result;
				},
				closeEncounterByIdInContent(content: string, encounterId: string): LonelogApiMutationResult<string> {
					const result = closeEncounterByIdInContent(content, encounterId);
					events.trigger("combat-encounter-closed", { target: "content", block: result.value });
					return result;
				},
				async closeEncounterByIdInFile(file: TFile, encounterId: string): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.combat.mutate.closeEncounterByIdInContent(content, encounterId);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("combat-encounter-closed", { target: "file", file, block: result.value });
					return result;
				},
			},
		},
		progress: {
			parseContent(content: string): ParsedElements["progress"] {
				return NotationParser.parse(content).progress;
			},
			async parseFile(file: TFile): Promise<ParsedElements["progress"]> {
				const content = await readMarkdownFile(host, file);
				return NotationParser.parse(content).progress;
			},
			list(content: string): ParsedProgress[] {
				return NotationParser.parse(content).progress;
			},
			get(content: string, name: string, kind?: ParsedProgress["type"]): ParsedProgress | null {
				return NotationParser.parse(content).progress.find((item) =>
					item.name === name && (kind ? item.type === kind : true)
				) ?? null;
			},
			getLatestTrack(content: string, name?: string): ParsedProgress | null {
				const items = NotationParser.parse(content).progress.filter((item) =>
					item.type === "track" && (name ? item.name === name : true)
				);
				if (items.length === 0) return null;
				return items.reduce((latest, item) => item.line > latest.line ? item : latest);
			},
			openView(): Promise<void> {
				return host.activateView(VIEW_TYPES.progress);
			},
			serialize: {
				tag(input: LonelogApiProgressTagInput): string {
					return serializeProgressTag(input);
				},
			},
				mutate: {
					upsertInContent(content: string, input: LonelogApiProgressTagInput): LonelogApiMutationResult<string> {
						const result = upsertProgressInContent(content, input);
						events.trigger("progress-mutated", {
							target: "content",
							tag: result.value,
							updated: result.updated,
							inserted: result.inserted,
							input,
						});
						return result;
					},
					async upsertInFile(file: TFile, input: LonelogApiProgressTagInput): Promise<LonelogApiMutationResult<string>> {
						const content = await readMarkdownFile(host, file);
						const result = upsertProgressInContent(content, input);
						await writeMarkdownFile(host, file, result.content);
						events.trigger("progress-mutated", {
							target: "file",
							file,
							tag: result.value,
							updated: result.updated,
							inserted: result.inserted,
							input,
						});
						return result;
					},
				},
		},
		partylog: {
			parseContent(content: string): PartylogParsedDocument {
				return PartylogParser.parse(content);
			},
			async parseFile(file: TFile): Promise<PartylogParsedDocument> {
				const content = await readMarkdownFile(host, file);
				return PartylogParser.parse(content);
			},
			hasBlocks(target: TFile | string): Promise<boolean> {
				return api.parse.partylog.hasBlocks(target);
			},
			getLatestBlockIndex(content: string): number | null {
				const blocks = getPartylogBlocks(content);
				return blocks.length > 0 ? blocks.length - 1 : null;
			},
			getOpenThreads(content: string): Array<{ name: string; state: string }> {
				return Array.from(PartylogParser.parse(content).threads.values())
					.filter((thread) => thread.state.toLowerCase() !== "closed")
					.map((thread) => ({ name: thread.name, state: thread.state }));
			},
			getActiveGoals(content: string): Array<{ name: string; state: string; type: "goal" | "quest" }> {
				const parsed = PartylogParser.parse(content);
				const goals = Array.from(parsed.goals.values())
					.filter((goal) => goal.state.toLowerCase() !== "closed" && goal.state.toLowerCase() !== "completed")
					.map((goal) => ({ name: goal.name, state: goal.state, type: goal.type }));
				const quests = Array.from(parsed.quests.values())
					.filter((quest) => quest.state.toLowerCase() !== "closed" && quest.state.toLowerCase() !== "completed")
					.map((quest) => ({ name: quest.name, state: quest.state, type: quest.type }));
				return [...goals, ...quests];
			},
			getPartyResource(content: string, key: string): { key: string; value: string } | null {
				const resource = PartylogParser.parse(content).partyResources.get(key);
				return resource ? { key: resource.key, value: resource.value } : null;
			},
			isEnabled(): boolean {
				return host.settings.enablePartylogAddon;
			},
			openView(): Promise<void> {
				return host.activateView(VIEW_TYPES.partylogDashboard);
			},
			serialize: {
				entry(input: LonelogApiPartylogEntryInput): string {
					return serializePartylogEntry(input);
				},
				tag(input: LonelogApiPartylogTagInput): string {
					return serializePartylogTag(input);
				},
			},
			mutate: {
				appendEntryToContent(content: string, input: LonelogApiPartylogEntryInput): LonelogApiMutationResult<string> {
					const result = appendPartylogEntryToContent(content, input);
					events.trigger("partylog-entry-appended", {
						target: "content",
						entry: result.value,
						input,
					});
					return result;
				},
				async appendEntryToFile(file: TFile, input: LonelogApiPartylogEntryInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = appendPartylogEntryToContent(content, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("partylog-entry-appended", {
						target: "file",
						file,
						entry: result.value,
						input,
					});
					return result;
				},
				appendEntryToBlockInContent(content: string, blockIndex: number, input: LonelogApiPartylogEntryInput): LonelogApiMutationResult<string> {
					const entry = serializePartylogEntry(input);
					const result = appendRawPartylogLineToBlockContent(content, blockIndex, entry);
					events.trigger("partylog-entry-appended", { target: "content", entry: result.value, input });
					return result;
				},
				async appendEntryToBlockInFile(file: TFile, blockIndex: number, input: LonelogApiPartylogEntryInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.partylog.mutate.appendEntryToBlockInContent(content, blockIndex, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("partylog-entry-appended", { target: "file", file, entry: result.value, input });
					return result;
				},
				appendTagToContent(content: string, input: LonelogApiPartylogTagInput): LonelogApiMutationResult<string> {
					const tag = serializePartylogTag(input);
					const result = appendRawPartylogLineToContent(content, tag);
					events.trigger("partylog-tag-appended", {
						target: "content",
						tag,
						input,
					});
					return result;
				},
				async appendTagToFile(file: TFile, input: LonelogApiPartylogTagInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const tag = serializePartylogTag(input);
					const result = appendRawPartylogLineToContent(content, tag);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("partylog-tag-appended", {
						target: "file",
						file,
						tag,
						input,
					});
					return result;
				},
				appendTagToBlockInContent(content: string, blockIndex: number, input: LonelogApiPartylogTagInput): LonelogApiMutationResult<string> {
					const tag = serializePartylogTag(input);
					const result = appendRawPartylogLineToBlockContent(content, blockIndex, tag);
					events.trigger("partylog-tag-appended", { target: "content", tag, input });
					return result;
				},
				async appendTagToBlockInFile(file: TFile, blockIndex: number, input: LonelogApiPartylogTagInput): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.partylog.mutate.appendTagToBlockInContent(content, blockIndex, input);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("partylog-tag-appended", { target: "file", file, tag: result.value, input });
					return result;
				},
				upsertGoalInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string> {
					const tag = serializePartylogTag({ ...input, type: "goal" });
					const result = upsertRawPartylogLineInBlockContent(content, blockIndex, tag, new RegExp(`^\\[Goal:${escapeRegex(input.name ?? "")}(?:\\||\\])`, "i"));
					events.trigger("partylog-tag-mutated", { target: "content", tag, action: "upsert-goal" });
					return result;
				},
				async upsertGoalInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.partylog.mutate.upsertGoalInContent(content, input, blockIndex);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("partylog-tag-mutated", { target: "file", file, tag: result.value, action: "upsert-goal" });
					return result;
				},
				upsertQuestInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string> {
					const tag = serializePartylogTag({ ...input, type: "quest" });
					const result = upsertRawPartylogLineInBlockContent(content, blockIndex, tag, new RegExp(`^\\[Quest:${escapeRegex(input.name ?? "")}(?:\\||\\])`, "i"));
					events.trigger("partylog-tag-mutated", { target: "content", tag, action: "upsert-quest" });
					return result;
				},
				async upsertQuestInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.partylog.mutate.upsertQuestInContent(content, input, blockIndex);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("partylog-tag-mutated", { target: "file", file, tag: result.value, action: "upsert-quest" });
					return result;
				},
				upsertFactionInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string> {
					const tag = serializePartylogTag({ ...input, type: "faction" });
					const result = upsertRawPartylogLineInBlockContent(content, blockIndex, tag, new RegExp(`^\\[Faction:${escapeRegex(input.name ?? "")}(?:\\||\\])`, "i"));
					events.trigger("partylog-tag-mutated", { target: "content", tag, action: "upsert-faction" });
					return result;
				},
				async upsertFactionInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.partylog.mutate.upsertFactionInContent(content, input, blockIndex);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("partylog-tag-mutated", { target: "file", file, tag: result.value, action: "upsert-faction" });
					return result;
				},
				upsertThreadInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string> {
					const tag = serializePartylogTag({ ...input, type: "thread" });
					const result = upsertRawPartylogLineInBlockContent(content, blockIndex, tag, new RegExp(`^\\[Thread:${escapeRegex(input.name ?? "")}(?:\\||\\])`, "i"));
					events.trigger("partylog-tag-mutated", { target: "content", tag, action: "upsert-thread" });
					return result;
				},
				async upsertThreadInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.partylog.mutate.upsertThreadInContent(content, input, blockIndex);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("partylog-tag-mutated", { target: "file", file, tag: result.value, action: "upsert-thread" });
					return result;
				},
				upsertPartyInContent(content: string, input: LonelogApiPartylogTagInput, blockIndex?: number): LonelogApiMutationResult<string> {
					const tag = serializePartylogTag({ ...input, type: "party" });
					const result = upsertRawPartylogLineInBlockContent(content, blockIndex, tag, /^\[Party:/i);
					events.trigger("partylog-tag-mutated", { target: "content", tag, action: "upsert-party" });
					return result;
				},
				async upsertPartyInFile(file: TFile, input: LonelogApiPartylogTagInput, blockIndex?: number): Promise<LonelogApiMutationResult<string>> {
					const content = await readMarkdownFile(host, file);
					const result = api.partylog.mutate.upsertPartyInContent(content, input, blockIndex);
					await writeMarkdownFile(host, file, result.content);
					events.trigger("partylog-tag-mutated", { target: "file", file, tag: result.value, action: "upsert-party" });
					return result;
				},
			},
		},
		info: {
			get(): LonelogApiInfo {
				return {
					id: host.manifest?.id ?? "lonelog",
					name: host.manifest?.name ?? "Lonelog",
					version: host.manifest?.version ?? "unknown",
					minAppVersion: host.manifest?.minAppVersion ?? "unknown",
					apiVersion: LONELOG_API_VERSION,
				};
			},
			getModules(): Record<string, LonelogApiModuleInfo> {
				return getModuleInfo();
			},
			getStabilityPolicy(): LonelogApiStabilityPolicy {
				return getStabilityPolicy();
			},
		},
		errors: {
			codes: LONELOG_API_ERROR_CODES,
			isLonelogApiError,
		},
		events: {
			on(name, callback): LonelogApiEventRef {
				return events.on(name, callback);
			},
			off(name, callback): void {
				events.off(name, callback);
			},
			offref(ref: LonelogApiEventRef): void {
				events.offref(ref);
			},
		},
		parse: {
			content(content: string): ParsedElements {
				return NotationParser.parse(content);
			},
			async file(file: TFile): Promise<ParsedElements> {
				const content = await readMarkdownFile(host, file);
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

				const content = await readMarkdownFile(host, target);
				return isLonelogContent(content);
			},
			partylog: {
				content(content: string): PartylogParsedDocument {
					return PartylogParser.parse(content);
				},
				async file(file: TFile): Promise<PartylogParsedDocument> {
					const content = await readMarkdownFile(host, file);
					return PartylogParser.parse(content);
				},
				async hasBlocks(target: TFile | string): Promise<boolean> {
					if (typeof target === "string") {
						return hasPartylogBlocks(target);
					}

					if (target.extension !== "md") return false;
					const content = await readMarkdownFile(host, target);
					return hasPartylogBlocks(content);
				},
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

	return { api, internal };
}

export type { ParsedElements, PartylogParsedDocument, Token };
