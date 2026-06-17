import {
	NotationParser,
	ParsedCombatEncounter,
	ParsedEntity,
	ParsedItem,
	ParsedProgress,
	ParsedRoom,
	ParsedSession,
	ParsedThread,
} from "./parser";
import { TableDefinition, TableResolver } from "./table-resolver";

export type PartylogTimelineType =
	| "action"
	| "world-event"
	| "question"
	| "oracle-answer"
	| "dice"
	| "consequence"
	| "dialogue"
	| "meta"
	| "table"
	| "generator";

export type PartylogActorMode = "solo" | "assist" | "group" | "list";

export interface PartylogDiceSemantics {
	comparison?: {
		left: string;
		operator: string;
		right: string;
	};
	contextTags: string[];
	resultCode?: string;
}

export interface PartylogTimelineEntry {
	type: PartylogTimelineType;
	line: number;
	raw: string;
	text: string;
	actor?: string;
	actorNames?: string[];
	actorMode?: PartylogActorMode;
	outcome?: string;
	sessionNumber?: number;
	sceneNumber?: string;
	sceneContext?: string;
	interludeTitle?: string;
	metaKind?: string;
	speakerType?: "pc" | "npc" | "other";
	dice?: PartylogDiceSemantics;
}

export interface PartylogRosterEntry {
	name: string;
	actionCount: number;
	rollCount: number;
	questionCount: number;
	dialogueCount: number;
	mentionLines: number[];
	lastSceneNumber?: string;
	lastSceneContext?: string;
	lastInterludeTitle?: string;
}

export interface PartylogResourceState {
	key: string;
	value: string;
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface PartylogFactionState {
	name: string;
	tier?: string;
	standing?: string;
	tags: string[];
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface PartylogObjectiveState {
	name: string;
	state: string;
	type: "goal" | "quest";
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface PartylogLootState {
	name: string;
	tags: string[];
	active: boolean;
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface PartylogAdvancementEntry {
	name: string;
	summary: string;
	gains: string[];
	line: number;
	sessionNumber?: number;
	sceneNumber?: string;
	interludeTitle?: string;
}

export interface PartylogOOCEntry {
	label: string;
	details: string[];
	line: number;
	sessionNumber?: number;
}

export interface PartylogDialogueEntry {
	speaker: string;
	speakerType: "pc" | "npc" | "other";
	text: string;
	line: number;
	sessionNumber?: number;
	sceneNumber?: string;
	interludeTitle?: string;
}

export interface PartylogMetaEntry {
	kind: string;
	text: string;
	parts: string[];
	line: number;
	sessionNumber?: number;
	sceneNumber?: string;
	interludeTitle?: string;
}

export interface PartylogNarrativeBlock {
	lineStart: number;
	lineEnd: number;
	text: string;
	sessionNumber?: number;
	sceneNumber?: string;
	sceneContext?: string;
	interludeTitle?: string;
}

export interface PartylogGeneratorBlock {
	title: string;
	line: number;
	rows: string[];
}

export interface PartylogSessionEnd {
	sessionNumber?: number;
	line: number;
	advancements: PartylogAdvancementEntry[];
	partyUpdates: string[];
	hooks: string[];
	notes: string[];
}

export interface PartylogInterlude {
	title: string;
	line: number;
	meta: PartylogMetaEntry[];
	partyUpdates: string[];
	factionUpdates: string[];
}

export interface PartylogAuthorityWarning {
	type: "mixed-authority";
	sessionNumber?: number;
	line: number;
	message: string;
}

export interface PartylogParsedDocument {
	hasPartylogBlocks: boolean;
	blockCount: number;
	sessions: ParsedSession[];
	pcs: Map<string, ParsedEntity>;
	npcs: Map<string, ParsedEntity>;
	locations: Map<string, ParsedEntity>;
	threads: Map<string, ParsedThread>;
	rooms: Map<string, ParsedRoom>;
	inventory: Map<string, ParsedItem>;
	wealth: Map<string, string>;
	progress: ParsedProgress[];
	combat: ParsedCombatEncounter[];
	timeline: PartylogTimelineEntry[];
	roster: Map<string, PartylogRosterEntry>;
	partyResources: Map<string, PartylogResourceState>;
	factions: Map<string, PartylogFactionState>;
	goals: Map<string, PartylogObjectiveState>;
	quests: Map<string, PartylogObjectiveState>;
	loot: Map<string, PartylogLootState>;
	advancements: PartylogAdvancementEntry[];
	ooc: PartylogOOCEntry[];
	dialogue: PartylogDialogueEntry[];
	meta: PartylogMetaEntry[];
	narrativeBlocks: PartylogNarrativeBlock[];
	campaignHeader: Record<string, string | string[]>;
	tables: Map<string, TableDefinition>;
	generatorBlocks: PartylogGeneratorBlock[];
	sessionEnds: PartylogSessionEnd[];
	interludes: PartylogInterlude[];
	authorityWarnings: PartylogAuthorityWarning[];
}

interface PartylogSceneContext {
	sessionNumber?: number;
	sceneNumber?: string;
	sceneContext?: string;
	interludeTitle?: string;
	currentSessionEnd?: PartylogSessionEnd;
	currentInterlude?: PartylogInterlude;
}

interface PartylogParseState {
	timeline: PartylogTimelineEntry[];
	dialogue: PartylogDialogueEntry[];
	meta: PartylogMetaEntry[];
	narrativeBlocks: PartylogNarrativeBlock[];
	partyResources: Map<string, PartylogResourceState>;
	factions: Map<string, PartylogFactionState>;
	goals: Map<string, PartylogObjectiveState>;
	quests: Map<string, PartylogObjectiveState>;
	loot: Map<string, PartylogLootState>;
	advancements: PartylogAdvancementEntry[];
	ooc: PartylogOOCEntry[];
	generatorBlocks: PartylogGeneratorBlock[];
	sessionEnds: PartylogSessionEnd[];
	interludes: PartylogInterlude[];
	authorityWarnings: PartylogAuthorityWarning[];
	authorityBySession: Map<string, { hasWorldEvent: boolean; hasQuestion: boolean; line: number }>;
}

const TAG_RE = /\[(#?(?:N|L|PC|Thread|E|Clock|Track|Timer|F|R|Inv|Wealth|Party|Faction|Goal|Quest|Loot|Advance|OOC)):[^\]]*\]/g;

export class PartylogParser {
	static parse(content: string): PartylogParsedDocument {
		const base = NotationParser.parse(content);
		const parsedBlocks = this.parsePartylog(content);
		const roster = this.buildRoster(parsedBlocks.timeline, parsedBlocks.dialogue);

		return {
			hasPartylogBlocks: parsedBlocks.blockCount > 0,
			blockCount: parsedBlocks.blockCount,
			sessions: base.sessions,
			pcs: base.pcs,
			npcs: base.npcs,
			locations: base.locations,
			threads: base.threads,
			rooms: base.rooms,
			inventory: base.inventory,
			wealth: base.wealth,
			progress: base.progress,
			combat: base.combat,
			timeline: parsedBlocks.timeline,
			roster,
			partyResources: parsedBlocks.partyResources,
			factions: parsedBlocks.factions,
			goals: parsedBlocks.goals,
			quests: parsedBlocks.quests,
			loot: parsedBlocks.loot,
			advancements: parsedBlocks.advancements,
			ooc: parsedBlocks.ooc,
			dialogue: parsedBlocks.dialogue,
			meta: parsedBlocks.meta,
			narrativeBlocks: parsedBlocks.narrativeBlocks,
			campaignHeader: this.parseCampaignFrontmatter(content),
			tables: TableResolver.parseTables(content),
			generatorBlocks: parsedBlocks.generatorBlocks,
			sessionEnds: parsedBlocks.sessionEnds,
			interludes: parsedBlocks.interludes,
			authorityWarnings: parsedBlocks.authorityWarnings,
		};
	}

	private static parsePartylog(content: string): PartylogParseState & { blockCount: number } {
		const lines = content.split("\n");
		const state: PartylogParseState = {
			timeline: [],
			dialogue: [],
			meta: [],
			narrativeBlocks: [],
			partyResources: new Map(),
			factions: new Map(),
			goals: new Map(),
			quests: new Map(),
			loot: new Map(),
			advancements: [],
			ooc: [],
			generatorBlocks: [],
			sessionEnds: [],
			interludes: [],
			authorityWarnings: [],
			authorityBySession: new Map(),
		};
		let inPartylogBlock = false;
		let blockCount = 0;
		let context: PartylogSceneContext = {};
		let activeGenerator: PartylogGeneratorBlock | null = null;
		let activeNarrative: { lineStart: number; lines: string[]; context: PartylogSceneContext } | null = null;

		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index] ?? "";
			const trimmed = line.trim();

			const sessionMatch = /^##\s+Session\s+(\d+)(.*)$/i.exec(line);
			if (sessionMatch?.[1]) {
				context = {
					sessionNumber: parseInt(sessionMatch[1], 10),
					sceneNumber: undefined,
					sceneContext: undefined,
					interludeTitle: undefined,
					currentSessionEnd: undefined,
					currentInterlude: undefined,
				};
			}

			const interludeMatch = /^##\s+Interlude:\s*(.+)$/i.exec(line);
			if (interludeMatch?.[1]) {
				const interlude: PartylogInterlude = {
					title: interludeMatch[1].trim(),
					line: index,
					meta: [],
					partyUpdates: [],
					factionUpdates: [],
				};
				state.interludes.push(interlude);
				context = {
					...context,
					sceneNumber: undefined,
					sceneContext: undefined,
					interludeTitle: interlude.title,
					currentInterlude: interlude,
					currentSessionEnd: undefined,
				};
			}

			const sessionEndMatch = /^###\s+End of Session\s*(\d+)?/i.exec(line);
			if (sessionEndMatch) {
				const sessionEnd: PartylogSessionEnd = {
					sessionNumber: sessionEndMatch[1] ? parseInt(sessionEndMatch[1], 10) : context.sessionNumber,
					line: index,
					advancements: [],
					partyUpdates: [],
					hooks: [],
					notes: [],
				};
				state.sessionEnds.push(sessionEnd);
				context = {
					...context,
					currentSessionEnd: sessionEnd,
					interludeTitle: undefined,
					currentInterlude: undefined,
				};
			}

			if (!sessionEndMatch) {
				const richSceneMatch = /^###\s+([A-Z\d.-]+)\s*\*([^*]*)\*/.exec(line);
				if (richSceneMatch?.[1]) {
					context = {
						...context,
						sceneNumber: richSceneMatch[1],
						sceneContext: richSceneMatch[2]?.trim() || "Scene",
						interludeTitle: undefined,
						currentInterlude: undefined,
						currentSessionEnd: undefined,
					};
				} else {
					const simpleSceneMatch = /^###\s+([A-Z\d.-]+)(?:\s+(.*))?$/.exec(line);
					if (simpleSceneMatch?.[1]) {
						context = {
							...context,
							sceneNumber: simpleSceneMatch[1],
							sceneContext: simpleSceneMatch[2]?.trim() || "Scene",
							interludeTitle: undefined,
							currentInterlude: undefined,
							currentSessionEnd: undefined,
						};
					}
				}
			}

			if (!inPartylogBlock && /^```partylog\b/i.test(trimmed)) {
				inPartylogBlock = true;
				blockCount += 1;
				activeGenerator = null;
				continue;
			}

			if (inPartylogBlock && trimmed.startsWith("```")) {
				inPartylogBlock = false;
				activeGenerator = null;
				continue;
			}

			if (!inPartylogBlock) continue;
			if (trimmed === "") {
				activeGenerator = null;
				continue;
			}

			if (activeNarrative) {
				if (/^(---\\|-{3,})$/.test(trimmed)) {
					state.narrativeBlocks.push({
						lineStart: activeNarrative.lineStart,
						lineEnd: index,
						text: activeNarrative.lines.join("\n").trim(),
						sessionNumber: activeNarrative.context.sessionNumber,
						sceneNumber: activeNarrative.context.sceneNumber,
						sceneContext: activeNarrative.context.sceneContext,
						interludeTitle: activeNarrative.context.interludeTitle,
					});
					activeNarrative = null;
				} else {
					activeNarrative.lines.push(line);
				}
				continue;
			}

			if (/^\\---?$/.test(trimmed)) {
				activeNarrative = { lineStart: index, lines: [], context: { ...context } };
				continue;
			}

			if (activeGenerator && (/^\s+/.test(line) || /^\|/.test(trimmed))) {
				activeGenerator.rows.push(trimmed);
			}

			const timelineEntry = this.parseTimelineLine(line, index, context, state);
			if (timelineEntry) {
				state.timeline.push(timelineEntry);
				if (timelineEntry.type === "generator") {
					activeGenerator = {
						title: timelineEntry.text,
						line: index,
						rows: [],
					};
					state.generatorBlocks.push(activeGenerator);
				} else if (!(/^\s+/.test(line) || /^\|/.test(trimmed))) {
					activeGenerator = null;
				}
			} else if (!(/^\s+/.test(line) || /^\|/.test(trimmed))) {
				activeGenerator = null;
			}

			this.parseStructuredLine(line, index, context, state);
		}

		return { ...state, blockCount };
	}

	private static parseTimelineLine(
		line: string,
		lineNumber: number,
		context: PartylogSceneContext,
		state: PartylogParseState
	): PartylogTimelineEntry | null {
		const actionMatch = /^@\(([^)]+)\)\s*(.*)$/.exec(line);
		if (actionMatch) {
			const actorMeta = this.parseActorField(actionMatch[1] ?? "");
			return this.withContext(
				{
					type: "action",
					line: lineNumber,
					raw: line,
					actor: actionMatch[1]?.trim(),
					actorNames: actorMeta.actorNames,
					actorMode: actorMeta.actorMode,
					text: actionMatch[2]?.trim() || "",
				},
				context
			);
		}

		const implicitActionMatch = /^@\s*(.*)$/.exec(line);
		if (implicitActionMatch) {
			return this.withContext(
				{
					type: "action",
					line: lineNumber,
					raw: line,
					actorMode: "solo",
					text: implicitActionMatch[1]?.trim() || "",
				},
				context
			);
		}

		const questionMatch = /^\?\(([^)]+)\)\s*(.*)$/.exec(line);
		if (questionMatch) {
			const actorMeta = this.parseActorField(questionMatch[1] ?? "");
			this.registerAuthorityUsage(state, context.sessionNumber, "question", lineNumber);
			return this.withContext(
				{
					type: "question",
					line: lineNumber,
					raw: line,
					actor: questionMatch[1]?.trim(),
					actorNames: actorMeta.actorNames,
					actorMode: actorMeta.actorMode,
					text: questionMatch[2]?.trim() || "",
				},
				context
			);
		}

		const implicitQuestionMatch = /^\?\s*(.*)$/.exec(line);
		if (implicitQuestionMatch) {
			this.registerAuthorityUsage(state, context.sessionNumber, "question", lineNumber);
			return this.withContext(
				{
					type: "question",
					line: lineNumber,
					raw: line,
					text: implicitQuestionMatch[1]?.trim() || "",
				},
				context
			);
		}

		const answerMatch = /^->\s*(.*)$/.exec(line);
		if (answerMatch) {
			return this.withContext(
				{
					type: "oracle-answer",
					line: lineNumber,
					raw: line,
					text: answerMatch[1]?.trim() || "",
					outcome: answerMatch[1]?.trim() || "",
				},
				context
			);
		}

		const eventMatch = /^!\s*(.*)$/.exec(line);
		if (eventMatch) {
			this.registerAuthorityUsage(state, context.sessionNumber, "world-event", lineNumber);
			return this.withContext(
				{
					type: "world-event",
					line: lineNumber,
					raw: line,
					text: eventMatch[1]?.trim() || "",
				},
				context
			);
		}

		const diceMatch = /^d(?:\(([^)]+)\))?:\s*(.*?)(?:\s*->\s*(.*))?$/.exec(line);
		if (diceMatch) {
			const actorMeta = diceMatch[1] ? this.parseActorField(diceMatch[1]) : undefined;
			const diceText = diceMatch[2]?.trim() || "";
			const outcome = diceMatch[3]?.trim();
			return this.withContext(
				{
					type: "dice",
					line: lineNumber,
					raw: line,
					actor: diceMatch[1]?.trim(),
					actorNames: actorMeta?.actorNames,
					actorMode: actorMeta?.actorMode,
					text: diceText,
					outcome,
					dice: this.parseDiceSemantics(diceText, outcome),
				},
				context
			);
		}

		const consequenceMatch = /^=>\s*(.*)$/.exec(line);
		if (consequenceMatch) {
			return this.withContext(
				{
					type: "consequence",
					line: lineNumber,
					raw: line,
					text: consequenceMatch[1]?.trim() || "",
				},
				context
			);
		}

		const dialogueMatch = /^(PC|N|[^:]+?)\s?(?:\(([^)]+)\))?:\s*"(.*)"\s*$/.exec(line.trim());
		if (dialogueMatch) {
			const speakerType = this.resolveSpeakerType(dialogueMatch[1] ?? "");
			const speaker = (dialogueMatch[2] || dialogueMatch[1] || "").trim();
			return this.withContext(
				{
					type: "dialogue",
					line: lineNumber,
					raw: line,
					text: dialogueMatch[3]?.trim() || "",
					actor: speaker,
					actorNames: [speaker],
					actorMode: "solo",
					speakerType,
				},
				context
			);
		}

		const metaMatch = /^\(([^:]+):\s*(.*)\)$/.exec(line.trim());
		if (metaMatch) {
			return this.withContext(
				{
					type: "meta",
					line: lineNumber,
					raw: line,
					text: metaMatch[2]?.trim() || "",
					metaKind: metaMatch[1]?.trim().toLowerCase() || "meta",
				},
				context
			);
		}

		const tableMatch = /^tbl:\s*(.*)$/i.exec(line.trim());
		if (tableMatch) {
			return this.withContext(
				{
					type: "table",
					line: lineNumber,
					raw: line,
					text: tableMatch[1]?.trim() || "",
				},
				context
			);
		}

		const generatorMatch = /^gen:\s*(.*)$/i.exec(line.trim());
		if (generatorMatch) {
			return this.withContext(
				{
					type: "generator",
					line: lineNumber,
					raw: line,
					text: generatorMatch[1]?.trim() || "",
				},
				context
			);
		}

		return null;
	}

	private static parseStructuredLine(
		line: string,
		lineNumber: number,
		context: PartylogSceneContext,
		state: PartylogParseState
	): void {
		const trimmed = line.trim();
		if (!trimmed) return;

		const dialogueMatch = /^(PC|N|[^:]+?)\s?(?:\(([^)]+)\))?:\s*"(.*)"\s*$/.exec(trimmed);
		if (dialogueMatch) {
			const speakerType = this.resolveSpeakerType(dialogueMatch[1] ?? "");
			const speaker = (dialogueMatch[2] || dialogueMatch[1] || "").trim();
			state.dialogue.push({
				speaker,
				speakerType,
				text: dialogueMatch[3]?.trim() || "",
				line: lineNumber,
				sessionNumber: context.sessionNumber,
				sceneNumber: context.sceneNumber,
				interludeTitle: context.interludeTitle,
			});
		}

		const metaMatch = /^\(([^:]+):\s*(.*)\)$/.exec(trimmed);
		if (metaMatch) {
			const entry: PartylogMetaEntry = {
				kind: metaMatch[1]?.trim().toLowerCase() || "meta",
				text: metaMatch[2]?.trim() || "",
				parts: (metaMatch[2] || "").split("|").map((part) => part.trim()).filter(Boolean),
				line: lineNumber,
				sessionNumber: context.sessionNumber,
				sceneNumber: context.sceneNumber,
				interludeTitle: context.interludeTitle,
			};
			state.meta.push(entry);
			if (context.currentSessionEnd) {
				if (entry.kind === "hook") context.currentSessionEnd.hooks.push(entry.text);
				if (entry.kind === "note") context.currentSessionEnd.notes.push(entry.text);
			}
			if (context.currentInterlude) {
				context.currentInterlude.meta.push(entry);
			}
		}

		TAG_RE.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = TAG_RE.exec(line)) !== null) {
			const fullTag = match[0] ?? "";
			const tagType = match[1] ?? "";
			const payload = fullTag.slice(fullTag.indexOf(":") + 1, -1).trim();
			const normalized = tagType.replace(/^#/, "").toLowerCase();

			switch (normalized) {
				case "party":
					this.applyPartyTag(payload, lineNumber, context, state);
					break;
				case "faction":
					this.applyFactionTag(payload, lineNumber, context, state);
					break;
				case "goal":
					this.applyObjectiveTag("goal", payload, lineNumber, state);
					break;
				case "quest":
					this.applyObjectiveTag("quest", payload, lineNumber, state);
					break;
				case "loot":
					this.applyLootTag(payload, lineNumber, state);
					break;
				case "advance":
					this.applyAdvanceTag(payload, lineNumber, context, state);
					break;
				case "ooc":
					this.applyOOCTag(payload, lineNumber, context, state);
					break;
			}
		}
	}

	private static applyPartyTag(payload: string, line: number, context: PartylogSceneContext, state: PartylogParseState): void {
		const parts = payload.split("|").map((part) => part.trim()).filter(Boolean);
		parts.forEach((part) => {
			const separatorMatch = /^([^:]+):(.*)$/.exec(part);
			const numericDeltaMatch = /^([^:+-]+)([+-].+)$/.exec(part);
			let key = part;
			let value = part;

			if (separatorMatch?.[1]) {
				key = separatorMatch[1].trim();
				value = separatorMatch[2]?.trim() || "";
			} else if (numericDeltaMatch?.[1]) {
				key = numericDeltaMatch[1].trim();
				value = numericDeltaMatch[2]?.trim() || "";
			} else {
				const words = part.split(/\s+/);
				key = words.shift()?.trim() || part;
				value = words.join(" ").trim();
			}

			const existing = state.partyResources.get(key) ?? {
				key,
				value,
				mentions: [],
				firstMention: line,
				lastMention: line,
			};
			existing.value = value || existing.value;
			existing.mentions.push(line);
			existing.lastMention = line;
			state.partyResources.set(key, existing);
			if (context.currentSessionEnd) context.currentSessionEnd.partyUpdates.push(part);
			if (context.currentInterlude) context.currentInterlude.partyUpdates.push(part);
		});
	}

	private static applyFactionTag(payload: string, line: number, context: PartylogSceneContext, state: PartylogParseState): void {
		const parts = payload.split("|").map((part) => part.trim()).filter(Boolean);
		const name = parts.shift();
		if (!name) return;

		const existing = state.factions.get(name) ?? {
			name,
			tags: [],
			mentions: [],
			firstMention: line,
			lastMention: line,
		};

		parts.forEach((part) => {
			if (part.startsWith("tier:")) {
				existing.tier = part.slice(5).trim();
				return;
			}
			if (part.startsWith("standing:")) {
				existing.standing = part.slice(9).trim();
				return;
			}
			if (!existing.tags.includes(part)) existing.tags.push(part);
		});

		existing.mentions.push(line);
		existing.lastMention = line;
		state.factions.set(name, existing);
		if (context.currentInterlude) context.currentInterlude.factionUpdates.push(payload);
	}

	private static applyObjectiveTag(
		type: "goal" | "quest",
		payload: string,
		line: number,
		state: PartylogParseState
	): void {
		const parts = payload.split("|").map((part) => part.trim()).filter(Boolean);
		const name = parts.shift();
		if (!name) return;
		const targetMap = type === "goal" ? state.goals : state.quests;
		const existing = targetMap.get(name) ?? {
			name,
			state: parts[0] || "Open",
			type,
			mentions: [],
			firstMention: line,
			lastMention: line,
		};
		existing.state = parts[0] || existing.state;
		existing.mentions.push(line);
		existing.lastMention = line;
		targetMap.set(name, existing);
	}

	private static applyLootTag(payload: string, line: number, state: PartylogParseState): void {
		const trimmed = payload.trim();
		if (!trimmed) return;
		const removed = trimmed.startsWith("-");
		const cleanPayload = removed ? trimmed.slice(1).trim() : trimmed;
		const parts = cleanPayload.split("|").map((part) => part.trim()).filter(Boolean);
		const name = parts.shift();
		if (!name) return;

		const existing = state.loot.get(name) ?? {
			name,
			tags: [],
			active: true,
			mentions: [],
			firstMention: line,
			lastMention: line,
		};

		existing.active = !removed;
		parts.forEach((part) => {
			if (!existing.tags.includes(part)) existing.tags.push(part);
		});
		existing.mentions.push(line);
		existing.lastMention = line;
		state.loot.set(name, existing);
	}

	private static applyAdvanceTag(
		payload: string,
		line: number,
		context: PartylogSceneContext,
		state: PartylogParseState
	): void {
		const parts = payload.split("|").map((part) => part.trim()).filter(Boolean);
		const name = parts.shift();
		if (!name) return;
		const summary = parts.shift() || "";
		const gains = parts;
		const entry: PartylogAdvancementEntry = {
			name,
			summary,
			gains,
			line,
			sessionNumber: context.sessionNumber,
			sceneNumber: context.sceneNumber,
			interludeTitle: context.interludeTitle,
		};
		state.advancements.push(entry);
		if (context.currentSessionEnd) context.currentSessionEnd.advancements.push(entry);
	}

	private static applyOOCTag(
		payload: string,
		line: number,
		context: PartylogSceneContext,
		state: PartylogParseState
	): void {
		const parts = payload.split("|").map((part) => part.trim()).filter(Boolean);
		const label = parts.shift() || payload.trim();
		state.ooc.push({
			label,
			details: parts,
			line,
			sessionNumber: context.sessionNumber,
		});
	}

	private static parseDiceSemantics(text: string, outcome?: string): PartylogDiceSemantics {
		const comparisonMatch = /(\S+)\s*(>=|<=|≥|≤|vs)\s*(\S+)/i.exec(text);
		const contextTagMatch = /\[([^\]]+)\]/.exec(text);
		const resultCodeMatch = outcome ? /^(S|F|Hit|Miss|Success|Fail)\b/i.exec(outcome.trim()) : null;

		return {
			comparison: comparisonMatch
				? {
					left: comparisonMatch[1] ?? "",
					operator: comparisonMatch[2] ?? "",
					right: comparisonMatch[3] ?? "",
				}
				: undefined,
			contextTags: contextTagMatch?.[1]
				? contextTagMatch[1].split(",").map((part) => part.trim()).filter(Boolean)
				: [],
			resultCode: resultCodeMatch?.[1],
		};
	}

	private static buildRoster(
		timeline: PartylogTimelineEntry[],
		dialogue: PartylogDialogueEntry[]
	): Map<string, PartylogRosterEntry> {
		const roster = new Map<string, PartylogRosterEntry>();

		timeline.forEach((entry) => {
			const names = entry.actorNames ?? (entry.actor ? this.extractActorNames(entry.actor) : []);
			if (names.length === 0) return;

			names.forEach((name) => {
				const existing = roster.get(name) ?? {
					name,
					actionCount: 0,
					rollCount: 0,
					questionCount: 0,
					dialogueCount: 0,
					mentionLines: [],
				};

				if (entry.type === "action") existing.actionCount += 1;
				if (entry.type === "dice") existing.rollCount += 1;
				if (entry.type === "question") existing.questionCount += 1;
				existing.mentionLines.push(entry.line);
				existing.lastSceneNumber = entry.sceneNumber;
				existing.lastSceneContext = entry.sceneContext;
				existing.lastInterludeTitle = entry.interludeTitle;
				roster.set(name, existing);
			});
		});

		dialogue.forEach((entry) => {
			const existing = roster.get(entry.speaker) ?? {
				name: entry.speaker,
				actionCount: 0,
				rollCount: 0,
				questionCount: 0,
				dialogueCount: 0,
				mentionLines: [],
			};
			existing.dialogueCount += 1;
			existing.mentionLines.push(entry.line);
			existing.lastSceneNumber = entry.sceneNumber;
			existing.lastInterludeTitle = entry.interludeTitle;
			roster.set(entry.speaker, existing);
		});

		return roster;
	}

	private static parseActorField(actorText: string): { actorNames: string[]; actorMode: PartylogActorMode } {
		const trimmed = actorText.trim();
		if (!trimmed) return { actorNames: [], actorMode: "solo" };
		if (trimmed.includes(">")) {
			return { actorNames: this.extractActorNames(trimmed), actorMode: "assist" };
		}
		if (trimmed.includes("+")) {
			return { actorNames: this.extractActorNames(trimmed), actorMode: "group" };
		}
		if (trimmed.includes(",") || trimmed.includes("&")) {
			return { actorNames: this.extractActorNames(trimmed), actorMode: "list" };
		}
		return { actorNames: [this.normalizeActorName(trimmed)], actorMode: "solo" };
	}

	private static extractActorNames(actorText: string): string[] {
		return actorText
			.split(/[+,&>]/)
			.map((name) => this.normalizeActorName(name))
			.filter((name) => name.length > 0);
	}

	private static normalizeActorName(name: string): string {
		return name.replace(/\basks\b/i, "").trim();
	}

	private static resolveSpeakerType(raw: string): "pc" | "npc" | "other" {
		const normalized = raw.trim().toLowerCase();
		if (normalized === "pc") return "pc";
		if (normalized === "n") return "npc";
		return "other";
	}

	private static registerAuthorityUsage(
		state: PartylogParseState,
		sessionNumber: number | undefined,
		kind: "question" | "world-event",
		line: number
	): void {
		const key = String(sessionNumber ?? "unknown-session");
		const existing = state.authorityBySession.get(key) ?? {
			hasWorldEvent: false,
			hasQuestion: false,
			line,
		};
		if (kind === "question") existing.hasQuestion = true;
		if (kind === "world-event") existing.hasWorldEvent = true;
		state.authorityBySession.set(key, existing);

		if (existing.hasQuestion && existing.hasWorldEvent) {
			const alreadyReported = state.authorityWarnings.some(
				(warning) => warning.sessionNumber === sessionNumber && warning.type === "mixed-authority"
			);
			if (!alreadyReported) {
				state.authorityWarnings.push({
					type: "mixed-authority",
					sessionNumber,
					line,
					message: "Partylog spec recommends not mixing `!` and `?` within the same session.",
				});
			}
		}
	}

	private static parseCampaignFrontmatter(content: string): Record<string, string | string[]> {
		const lines = content.split("\n");
		if (lines[0]?.trim() !== "---") return {};

		const result: Record<string, string | string[]> = {};
		let currentKey: string | null = null;

		for (let index = 1; index < lines.length; index += 1) {
			const line = lines[index] ?? "";
			if (line.trim() === "---") break;

			const listMatch = /^\s*-\s+(.*)$/.exec(line);
			if (listMatch && currentKey) {
				const existing = result[currentKey];
				if (Array.isArray(existing)) {
					existing.push(listMatch[1]?.trim() || "");
				} else if (typeof existing === "string" && existing.length > 0) {
					result[currentKey] = [existing, listMatch[1]?.trim() || ""];
				} else {
					result[currentKey] = [listMatch[1]?.trim() || ""];
				}
				continue;
			}

			const pairMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
			if (!pairMatch?.[1]) continue;

			currentKey = pairMatch[1].trim();
			const value = pairMatch[2]?.trim() || "";
			result[currentKey] = value;
		}

		return result;
	}

	private static withContext(
		entry: PartylogTimelineEntry,
		context: PartylogSceneContext
	): PartylogTimelineEntry {
		return {
			...entry,
			sessionNumber: context.sessionNumber,
			sceneNumber: context.sceneNumber,
			sceneContext: context.sceneContext,
			interludeTitle: context.interludeTitle,
		};
	}
}
