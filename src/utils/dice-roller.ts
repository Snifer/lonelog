/**
 * Dice Roller Utility
 * Handles parsing and rolling of standard RPG dice notation (ndm + mod)
 */

export interface RollResult {
	notation: string;
	total: number;
	rolls: number[];
	modifier: number;
	sides: number | "f";
	comparison?: {
		operator: string;
		target: number;
		success: boolean;
	};
	forceFlag?: "S" | "F";
}

/** Options for formatting a dice result into a line. */
export interface DiceFormatOptions {
	/** When true, show individual dice values instead of summing (e.g. 4d6=6,5,4,2) */
	detailMode?: boolean;
	/** Label for the highest individual die. Only shown when detailMode is true. Empty string = hide. */
	highLabel?: string;
	/** Whether to show the high annotation. Default: true. */
	showHigh?: boolean;
	/** Label for the lowest individual die. Only shown when detailMode is true. */
	lowLabel?: string;
	/** Whether to show the low annotation. Default: true. */
	showLow?: boolean;
}

export class DiceRoller {
	/**
	 * Parse and roll a dice notation string
	 * Example: "2d6 + 4", "1d10 - 1", "d20"
	 */
	static roll(notation: string): RollResult | null {
		// Clean notation: remove spaces (but keep track of original for flags)
		const original = notation.trim();
		const clean = original.replace(/\s+/g, "").toLowerCase();

		// Use a unified regex to find dice pools (e.g., 2d6, 4df) or static modifiers (e.g., +5, -2)
		const tokenRegex = /([+-]?)(?:(\d*)d(\d+|f)|(\d+))/gi;
		
		const rolls: number[] = [];
		let total = 0;
		let totalModifier = 0;
		let match: RegExpExecArray | null;
		let firstSides: number | "f" = 6;
		let foundAny = false;

		// We need to stop parsing dice/mods when we hit a comparison operator
		const compMatch = /(.+?)(vs|>=|<=|≥|≤)(\d+)/.exec(clean);
		const expressionPart = (compMatch && compMatch[1]) ? compMatch[1] : clean;

		while ((match = tokenRegex.exec(expressionPart)) !== null) {
			foundAny = true;
			const sign = match[1] === "-" ? -1 : 1;
			
			if (match[3]) {
				const count = match[2] ? parseInt(match[2]) : 1;
				const sidesRaw = match[3];
				const isFate = sidesRaw.toLowerCase() === "f";
				const sides = isFate ? "f" : parseInt(sidesRaw);
				
				if (rolls.length === 0) firstSides = sides;

				for (let i = 0; i < count; i++) {
					let r: number;
					if (isFate) {
						r = Math.floor(DiceRoller.getRandom() * 3) - 1;
					} else {
						r = Math.floor(DiceRoller.getRandom() * (sides as number)) + 1;
					}
					rolls.push(r);
					total += (r * sign);
				}
			} else if (match[4]) {
				const val = parseInt(match[4]) * sign;
				totalModifier += val;
				total += val;
			}
		}

		if (!foundAny && !compMatch) return null;

		// Handle comparison
		let comparison;
		if (compMatch && compMatch[2] && compMatch[3]) {
			const op = compMatch[2];
			const target = parseInt(compMatch[3]);
			let success = false;

			if (op === ">=" || op === "≥" || op === "vs") {
				success = total >= target;
			} else if (op === "<=" || op === "≤") {
				success = total <= target;
			}

			comparison = { operator: op, target, success };
		}

		// Handle forced S/F flag at the end
		let forceFlag: "S" | "F" | undefined;
		if (original.endsWith(" S")) forceFlag = "S";
		else if (original.endsWith(" F")) forceFlag = "F";

		return {
			notation,
			total,
			rolls,
			modifier: totalModifier,
			sides: firstSides,
			comparison,
			forceFlag
		};
	}

	/**
	 * Extracts a dice notation from a Lonelog line (d:, ?, tbl:, or gen:)
	 * Example: "d: 2d6 + 4 -> 10" returns "2d6+4"
	 * Example: "? Is it rain? (d6=6)" returns "d6"
	 * Example: "tbl: d100=42" returns "d100"
	 */
	static extractNotation(line: string): string | null {
		// First, try the standard prefixes (anchored to start of line or with space prefix)
		const dMatch = /^\s*(?:d:|\?|tbl:|gen:)\s*([^->\n]+)/i.exec(line);
		let basePart: string | null = null;
		
		if (dMatch && dMatch[1]) {
			basePart = dMatch[1].trim();
		} else {
			// Look for indented label lines: "  Apariencia: d3"
			const labelMatch = /^\s*([^:(\[\]]+):\s*([^->\n=]+)/.exec(line);
			if (labelMatch && labelMatch[1] && labelMatch[2]) {
				basePart = labelMatch[2].trim();
			} else {
				// Otherwise, look for complex dice notation
				const complexDiceMatch = /((?:\d*d(?:\d+|f)|[+-]\s*\d+)(?:\s*(?:[+-]|vs|>=|<=|≥|≤)\s*(?:\d*d(?:\d+|f)|\d+))*(\s*[SF])?)/i.exec(line);
				basePart = complexDiceMatch && complexDiceMatch[1] ? complexDiceMatch[1] : null;
			}
		}

		if (!basePart) return null;

		// Clean up: strip existing results (=...) to get pure notation(s)
		const segments = basePart.split(/,\s+(?=\d*d(?:\d+|f))/i);
		const notations = segments.map(seg => {
			const eqIndex = seg.indexOf("=");
			return eqIndex !== -1 ? seg.substring(0, eqIndex).trim() : seg.trim();
		});

		return notations.join(", ");
	}

	/**
	 * Formats a roll result back into the line, replacing or appending the result.
	 *
	 * Standard mode  → "d: 2d6=9"
	 * Detail mode    → "d: 4d6=6,5,4,2  (High=6) (Low=2)"
	 *
	 * If detailMode labels are empty strings, that annotation is omitted.
	 * The previous result (everything after "=") is replaced if already present.
	 */
	static formatResult(
		line: string,
		result: RollResult,
		options: DiceFormatOptions & { tableOutcome?: string } = {}
	): string {
		const {
			detailMode = false,
			highLabel = "High",
			showHigh = true,
			lowLabel = "Low",
			showLow = true,
			tableOutcome
		} = options;

		// 1. Identify the prefix (d:, ?, etc.) OR a Label:
		const dMatch = /^\s*(d:|\?|tbl:|gen:)\s*/i.exec(line);
		let prefix = dMatch ? dMatch[0] : "";
		
		// If no standard prefix, check if it's a Label: format
		if (!prefix) {
			const labelMatch = /^(\s*[^:(\[\]]+:\s*)/i.exec(line);
			if (labelMatch) prefix = labelMatch[0];
		}

		// Strip any existing outcome (everything after ->)
		const arrowIndex = line.indexOf("->");
		const lineToProcess = arrowIndex !== -1 ? line.substring(0, arrowIndex) : line;
		const contentAfterPrefix = lineToProcess.substring(prefix.length);

		// 2. Split into segments by comma followed by a new notation
		const segments = contentAfterPrefix.split(/,\s+(?=\d*d(?:\d+|f))/i);

		// 3. Process each segment
		const formattedSegments = segments.map(seg => {
			// Extract pure notation from this segment
			const eqIndex = seg.indexOf("=");
			const notation = eqIndex !== -1 ? seg.substring(0, eqIndex).trim() : seg.trim();
			
			const rollResult = DiceRoller.roll(notation);
			if (!rollResult) return seg;

			const isFate = rollResult.sides === "f";

			// Format the result suffix for this specific roll
			let resultSuffix: string;
			if (detailMode && rollResult.rolls.length > 0) {
				let suffix: string;
				
				if (isFate) {
					// Fate display: symbols (+, -, 0)
					suffix = rollResult.rolls.map(r => r === 1 ? "+" : r === -1 ? "-" : "0").join(",");
				} else {
					const sorted = [...rollResult.rolls].sort((a, b) => b - a);
					suffix = sorted.join(",");
					
					// Add annotations (High/Low) - only for non-Fate dice
					const annotations: string[] = [];
					if (showHigh && highLabel !== "") annotations.push(`${highLabel}=${sorted[0]}`);
					if (showLow && lowLabel !== "") {
						const lastVal = sorted[sorted.length - 1];
						if (lastVal !== undefined) annotations.push(`${lowLabel}=${lastVal}`);
					}

					if (annotations.length > 0) {
						suffix += "  (" + annotations.join(") (") + ")";
					}
				}

				// Final calculation display
				const totalStr = (isFate && rollResult.total >= 0) ? `+${rollResult.total}` : String(rollResult.total);
				
				if (rollResult.modifier !== 0 || rollResult.rolls.length > 1 || rollResult.comparison) {
					const modLabel = rollResult.modifier >= 0 ? `+${rollResult.modifier}` : `${rollResult.modifier}`;
					const modPart = rollResult.modifier !== 0 ? ` (${modLabel})` : "";
					
					let calculation = `${suffix}${modPart} = ${totalStr}`;
					
					if (rollResult.comparison) {
						const flag = rollResult.comparison.success ? "S" : "F";
						calculation += ` ${flag}`;
					} else if (rollResult.forceFlag) {
						calculation += ` ${rollResult.forceFlag}`;
					}

					resultSuffix = calculation;
				} else {
					resultSuffix = totalStr;
					if (rollResult.forceFlag) resultSuffix += ` ${rollResult.forceFlag}`;
				}
			} else {
				// Standard view: just the total and optional flag
				const totalStr = (isFate && rollResult.total >= 0) ? `+${rollResult.total}` : String(rollResult.total);
				resultSuffix = totalStr;
				
				if (rollResult.comparison) {
					resultSuffix += ` ${rollResult.comparison.success ? "S" : "F"}`;
				} else if (rollResult.forceFlag) {
					resultSuffix += ` ${rollResult.forceFlag}`;
				}
			}

			return `${notation}=${resultSuffix}`;
		});

		let finalLine = `${prefix}${formattedSegments.join(", ")}`;
		
		// If we have a table outcome, add it (replacing any original outcome since we stripped it above)
		if (tableOutcome) {
			finalLine += ` -> ${tableOutcome}`;
		} else if (arrowIndex !== -1) {
			// Restore the original outcome if we didn't have a new table outcome
			finalLine += ` ${line.substring(arrowIndex)}`;
		}

		return finalLine;
	}

	/**
	 * Cryptographically stronger random number generation if available
	 */
	private static getRandom(): number {
		if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
			const array = new Uint32Array(1);
			window.crypto.getRandomValues(array);
			const val = array[0];
			if (val !== undefined) {
				return val / (0xffffffff + 1);
			}
		}
		return Math.random();
	}
}
