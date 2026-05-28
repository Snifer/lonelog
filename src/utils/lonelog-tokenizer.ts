/**
 * Provides unified token detection logic for Lonelog notation.
 * Both rendering modes use this same tokenizer to ensure consistent highlighting.
 */

// ---------------------------------------------------------------------------
// Token types and patterns
// ---------------------------------------------------------------------------

export type TokenType =
	| "action"      // @ at line start
	| "question"    // ? at line start
	| "dice"        // d: at line start
	| "consequence" // => at line start
	| "result"      // -> anywhere
	| "tag"         // [N:...] etc.
	| "table"       // tbl: at line start
	| "generator"   // gen: at line start
	| "meta"        // (note: at line start
	| "dialogue"    // Speaker: "..." at line start
	| "scene"       // S1, T1-S1, ### S1 etc.
	| "header"      // === Session === etc.
	| "narrative"   // \--- or ---\ at line start
	| "round"       // Rd# at line start
	| "combat-block" // [COMBAT] at line start
	| "dungeon-block" // [DUNGEON STATUS] at line start
	| "foe"         // [F:...] tag
	| "room"        // [R:...] tag
	| "resources-block" // [RESOURCES] at line start
	| "inventory"   // [Inv:...] tag
	| "wealth"      // [Wealth:...] tag
	| "text";       // plain text

export interface Token {
	type: TokenType;
	start: number;  // relative to line start
	end: number;    // relative to line start
	text: string;
}

interface InlineTokenMatch {
	start: number;
	end: number;
	type: TokenType;
}

interface MultilineTagState {
	type: TokenType;
}

/** Line-start token patterns (checked in order) */
const LINE_START_PATTERNS: Array<{ pattern: RegExp; type: Exclude<TokenType, "result" | "tag" | "text"> }> = [
	{ pattern: /^@(?:\([^)]+\))?/, type: "action" },
	{ pattern: /^\?/, type: "question" },
	{ pattern: /^d:/, type: "dice" },
	{ pattern: /^=>/, type: "consequence" },
	{ pattern: /^tbl:/i, type: "table" },
	{ pattern: /^gen:/i, type: "generator" },
	{ pattern: /^\(/, type: "meta" },
	{ pattern: /^(\\---?|---\\|-{3,})/, type: "narrative" },
	{ pattern: /^(?:###\s*(?:Scene|Escena)\b|T?\d*-?S\d+(?:\.\d+|[a-z])?\b)/i, type: "scene" },
	{ pattern: /^(?:={3,}.+?={3,}|##\s+Sesi[óo]n\b|##\s+Session\b)/i, type: "header" },
	{ pattern: /^Rd\d+\b/i, type: "round" },
	{ pattern: /^\[\/?COMBAT\]/i, type: "combat-block" },
	{ pattern: /^\[\/?DUNGEON STATUS\]/i, type: "dungeon-block" },
	{ pattern: /^\[\/?RESOURCES\]/i, type: "resources-block" },
	{ pattern: /^(?:PC|N|[^:]+?)\s?(?:\([^)]+\))?:\s*".*?"/i, type: "dialogue" },
];

/** Result arrow pattern */
const RESULT_ARROW_RE = /->/g;

/** Bracket tag pattern — supports multi-line and inline update suffix like [Clock:Name 0/6 ->2/6] or [Track:Name 1.5/10] */
const BRACKET_TAG_RE = /\[(?:#?(?:N|L|PC|Thread|E|Clock|Track|Timer|F|R|Inv|Wealth)):[^\]]*(?:->\s*[\d./]+)?\]/g;
const MULTILINE_TAG_START_RE = /\[(#?(?:N|L|PC|Thread|E|Clock|Track|Timer|F|R|Inv|Wealth)):/i;

function getTagTokenType(tagText: string): TokenType {
	if (tagText.startsWith("[F:") || tagText.startsWith("[#F:")) return "foe";
	if (tagText.startsWith("[R:") || tagText.startsWith("[#R:")) return "room";
	if (tagText.startsWith("[Inv:") || tagText.startsWith("[#Inv:")) return "inventory";
	if (tagText.startsWith("[Wealth:") || tagText.startsWith("[#Wealth:")) return "wealth";
	return "tag";
}

function buildInlineTagTokens(lineText: string): InlineTokenMatch[] {
	const inlineTokens: InlineTokenMatch[] = [];

	BRACKET_TAG_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = BRACKET_TAG_RE.exec(lineText)) !== null) {
		const tagText = match[0];
		const type = getTagTokenType(tagText);

		if (tagText.includes("->")) {
			const arrowIndex = tagText.indexOf("->");
			inlineTokens.push({
				start: match.index,
				end: match.index + arrowIndex,
				type,
			});
			inlineTokens.push({
				start: match.index + arrowIndex + 2,
				end: match.index + tagText.length,
				type,
			});
		} else {
			inlineTokens.push({
				start: match.index,
				end: match.index + tagText.length,
				type,
			});
		}
	}

	return inlineTokens;
}

function buildLineTokens(lineText: string, lineType: TokenType | null, inlineTokens: InlineTokenMatch[]): Token[] {
	const tokens: Token[] = [];
	inlineTokens.sort((a, b) => a.start - b.start);

	if (lineType) {
		let pos = 0;

		for (const inline of inlineTokens) {
			if (inline.start > pos) {
				tokens.push({
					type: lineType,
					start: pos,
					end: inline.start,
					text: lineText.slice(pos, inline.start),
				});
			}

			tokens.push({
				type: inline.type,
				start: inline.start,
				end: inline.end,
				text: lineText.slice(inline.start, inline.end),
			});
			pos = inline.end;
		}

		if (pos < lineText.length) {
			tokens.push({
				type: lineType,
				start: pos,
				end: lineText.length,
				text: lineText.slice(pos),
			});
		}
	} else {
		let pos = 0;

		for (const inline of inlineTokens) {
			if (inline.start > pos) {
				tokens.push({
					type: "text",
					start: pos,
					end: inline.start,
					text: lineText.slice(pos, inline.start),
				});
			}

			tokens.push({
				type: inline.type,
				start: inline.start,
				end: inline.end,
				text: lineText.slice(inline.start, inline.end),
			});
			pos = inline.end;
		}

		if (pos < lineText.length) {
			tokens.push({
				type: "text",
				start: pos,
				end: lineText.length,
				text: lineText.slice(pos),
			});
		}
	}

	return tokens;
}

function tokenizeStandaloneLine(lineText: string): Token[] {
	const trimmed = lineText.trimStart();
	let lineType: TokenType | null = null;

	for (const { pattern, type } of LINE_START_PATTERNS) {
		const match = trimmed.match(pattern);
		if (match) {
			lineType = type;
			break;
		}
	}

	const inlineTokens: InlineTokenMatch[] = [];

	if (lineType !== "consequence") {
		RESULT_ARROW_RE.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = RESULT_ARROW_RE.exec(lineText)) !== null) {
			if (match.index > 0 && lineText[match.index - 1] === "=") continue;
			inlineTokens.push({
				start: match.index,
				end: match.index + 2,
				type: "result",
			});
		}
	}

	inlineTokens.push(...buildInlineTagTokens(lineText));
	return buildLineTokens(lineText, lineType, inlineTokens);
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a single line of Lonelog notation.
 * Returns an array of tokens with their positions and types.
 * 
 * Token precedence:
 * 1. Line-start tokens (@, ?, d:, =>) - applied to whole line except...
 * 2. Inline tokens (-> and [...]) - override line color
 */
export function tokenizeLine(lineText: string): Token[] {
	return tokenizeStandaloneLine(lineText);
}

export function tokenizeLines(lines: string[]): Token[][] {
	const tokenLines: Token[][] = [];
	let multilineState: MultilineTagState | null = null;

	for (const lineText of lines) {
		if (multilineState) {
			const closingIndex = lineText.indexOf("]");
			if (closingIndex === -1) {
				tokenLines.push(lineText.length > 0 ? [{
					type: multilineState.type,
					start: 0,
					end: lineText.length,
					text: lineText,
				}] : []);
				continue;
			}

			const tokens: Token[] = [];
			if (closingIndex > 0) {
				tokens.push({
					type: multilineState.type,
					start: 0,
					end: closingIndex,
					text: lineText.slice(0, closingIndex),
				});
			}
			tokens.push({
				type: multilineState.type,
				start: closingIndex,
				end: closingIndex + 1,
				text: "]",
			});

			const remainder = lineText.slice(closingIndex + 1);
			if (remainder.length > 0) {
				tokens.push(
					...tokenizeStandaloneLine(remainder).map((token) => ({
						...token,
						start: token.start + closingIndex + 1,
						end: token.end + closingIndex + 1,
					}))
				);
			}

			tokenLines.push(tokens);
			multilineState = null;
			continue;
		}

		const startMatch = MULTILINE_TAG_START_RE.exec(lineText);
		const openingIndex = startMatch?.index ?? -1;
		const closingIndex = openingIndex >= 0 ? lineText.indexOf("]", openingIndex) : -1;

		if (openingIndex >= 0 && closingIndex === -1) {
			const tokens: Token[] = [];
			if (openingIndex > 0) {
				tokens.push(...tokenizeStandaloneLine(lineText.slice(0, openingIndex)));
			}

			const tagType = getTagTokenType(lineText.slice(openingIndex));
			tokens.push({
				type: tagType,
				start: openingIndex,
				end: lineText.length,
				text: lineText.slice(openingIndex),
			});
			tokenLines.push(tokens);
			multilineState = { type: tagType };
			continue;
		}

		tokenLines.push(tokenizeStandaloneLine(lineText));
	}

	return tokenLines;
}

/**
 * Get CSS class name for a token type.
 * Prefix determines reading mode (ll-) vs editor mode (ll-ed-).
 */
export function getTokenClass(type: TokenType, prefix: "ll" | "ll-ed"): string {
	if (type === "text") return "";
	return `${prefix}-${type}`;
}
