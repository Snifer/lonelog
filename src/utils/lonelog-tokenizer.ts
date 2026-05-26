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
	const tokens: Token[] = [];
	const trimmed = lineText.trimStart();

	// Check for line-start token
	let lineType: TokenType | null = null;

	for (const { pattern, type } of LINE_START_PATTERNS) {
		const match = trimmed.match(pattern);
		if (match) {
			lineType = type;
			break;
		}
	}

	// Collect inline token positions (-> and [...])
	const inlineTokens: Array<{ start: number; end: number; type: TokenType }> = [];

	// Find result arrows (skip if line starts with => to avoid matching the >)
	if (lineType !== "consequence") {
		RESULT_ARROW_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = RESULT_ARROW_RE.exec(lineText)) !== null) {
			// Skip if it's part of =>
			if (m.index > 0 && lineText[m.index - 1] === "=") continue;
			inlineTokens.push({
				start: m.index,
				end: m.index + 2,
				type: "result",
			});
		}
	}

	// Find bracket tags
	BRACKET_TAG_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = BRACKET_TAG_RE.exec(lineText)) !== null) {
		const tagText = m[0];
		let type: TokenType = "tag";
		if (tagText.startsWith("[F:") || tagText.startsWith("[#F:")) {
			type = "foe";
		} else if (tagText.startsWith("[R:") || tagText.startsWith("[#R:")) {
			type = "room";
		} else if (tagText.startsWith("[Inv:") || tagText.startsWith("[#Inv:")) {
			type = "inventory";
		} else if (tagText.startsWith("[Wealth:") || tagText.startsWith("[#Wealth:")) {
			type = "wealth";
		}

		if(tagText.contains("->")) {
			inlineTokens.push({
				start: m.index,
				end: tagText.indexOf("->"),
				type: type
			});
			inlineTokens.push({
				start: tagText.indexOf("->")+2,
				end: tagText.length,
				type: type
			});
		} else if(!tagText.contains("->")){
			inlineTokens.push({
				start: m.index,
				end: m.index + tagText.length,
				type: type,
			});
		}

		
	}

	// Sort inline tokens by position
	inlineTokens.sort((a, b) => a.start - b.start);

	// Build final token list
	// If we have a line-level token, fill gaps between inline tokens with that color
	if (lineType) {
		let pos = 0;

		for (const inline of inlineTokens) {
			// Add line-colored text before this inline token
			if (inline.start > pos) {
				tokens.push({
					type: lineType,
					start: pos,
					end: inline.start,
					text: lineText.slice(pos, inline.start),
				});
			}
			// Add the inline token
			tokens.push({
				type: inline.type,
				start: inline.start,
				end: inline.end,
				text: lineText.slice(inline.start, inline.end),
			});
			pos = inline.end;
		}

		// Add remaining line-colored text
		if (pos < lineText.length) {
			tokens.push({
				type: lineType,
				start: pos,
				end: lineText.length,
				text: lineText.slice(pos),
			});
		}
	} else {
		// No line-level token, just plain text with inline tokens
		let pos = 0;

		for (const inline of inlineTokens) {
			// Plain text before token
			if (inline.start > pos) {
				tokens.push({
					type: "text",
					start: pos,
					end: inline.start,
					text: lineText.slice(pos, inline.start),
				});
			}
			// The token
			tokens.push({
				type: inline.type,
				start: inline.start,
				end: inline.end,
				text: lineText.slice(inline.start, inline.end),
			});
			pos = inline.end;
		}

		// Remaining plain text
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

/**
 * Get CSS class name for a token type.
 * Prefix determines reading mode (ll-) vs editor mode (ll-ed-).
 */
export function getTokenClass(type: TokenType, prefix: "ll" | "ll-ed"): string {
	if (type === "text") return "";
	return `${prefix}-${type}`;
}
