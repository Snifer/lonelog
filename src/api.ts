import type { TFile } from "obsidian";
import type { LonelogSettings } from "./settings";
import type { ParsedElements } from "./utils/parser";
import type { Token } from "./utils/lonelog-tokenizer";

export type PublicLonelogSettings = Pick<
	LonelogSettings,
	| "locale"
	| "defaultRibbonView"
	| "enableEditorHighlighting"
	| "enableReadingHighlighting"
	| "enableGlobalNotation"
	| "enableDiceRoller"
	| "enableCombatAddon"
	| "enableDungeonAddon"
	| "enableResourceAddon"
	| "enableCardAddon"
	| "enableDiceNotationAddon"
>;

export interface LonelogApi {
	apiVersion: "1";
	pluginVersion: string;
	parse: {
		content(content: string): ParsedElements;
		file(file: TFile): Promise<ParsedElements>;
		isLonelogNote(file: TFile): boolean;
	};
	tokenize: {
		line(line: string): Token[];
		lines(lines: string[]): Token[][];
	};
	settings: {
		get(): Readonly<PublicLonelogSettings>;
	};
	views: {
		openDashboard(): Promise<void>;
		openProgress(): Promise<void>;
		openThreads(): Promise<void>;
		openScenes(): Promise<void>;
		openCombat(): Promise<void>;
		openDungeon(): Promise<void>;
		openResources(): Promise<void>;
		open(viewType: string): Promise<void>;
	};
}
