import { RollResult, DiceRoller } from "./dice-roller";

export class AdvancedDiceRoller {
	/**
	 * Parse and roll a complex dice notation string 
	 * (Supports kh, kl, dh, dl, and !)
	 */
	static roll(notation: string): RollResult | null {
		const original = notation.trim();
		const clean = original.replace(/\s+/g, "").toLowerCase();

		// Remove context tags [...] before parsing dice to prevent them from interfering
		const cleanWithoutContext = clean.replace(/\[.*?\]/g, "");

		// Basic fallback if no advanced features detected
		if (!cleanWithoutContext.match(/[k!d]|cs|cf|min|max|>=|<=|>|</i)) {
			return DiceRoller.roll(notation);
		}

		// Simplified advanced parsing logic
		// Regex to capture: NdS + Modifiers
		const tokenRegex = /([+-]?)(?:(\d*)d(\d+|f)(!?)([kK][hH]?[lL]?\d*|[dD][hH]?[lL]?\d*)?|(\d+))/gi;

		let match: RegExpExecArray | null;
		let firstSides: number | "f" = 6;
		let foundAny = false;

		const originalRolls: number[] = [];
		let total = 0;
		let totalModifier = 0;

		const compMatch = /(.+?)(vs|>=|<=|≥|≤|>|<|=|!=)(\d+)/.exec(cleanWithoutContext);
		const expressionPart = compMatch && compMatch[1] ? compMatch[1] : cleanWithoutContext;

		while ((match = tokenRegex.exec(expressionPart)) !== null) {
			foundAny = true;
			const sign = match[1] === "-" ? -1 : 1;

			if (match[3]) {
				const count = match[2] ? parseInt(match[2]) : 1;
				const sidesRaw = match[3];
				const explode = !!match[4];
				const modStr = match[5] || "";
				
				const isFate = sidesRaw === "f";
				const sides = isFate ? "f" : parseInt(sidesRaw);
				
				if (originalRolls.length === 0) firstSides = sides;

				let pool: number[] = [];
				for (let i = 0; i < count; i++) {
					let r = AdvancedDiceRoller.rollDie(sides);
					pool.push(r);

					// Explode logic (default max roll)
					if (explode && !isFate && r === sides) {
						let safety = 100;
						while (r === sides && safety-- > 0) {
							r = AdvancedDiceRoller.rollDie(sides);
							pool.push(r);
						}
					}
				}

				originalRolls.push(...pool);
				
				// Apply Keep/Drop to a separate array for total calculation
				let keptPool = [...pool];
				if (modStr && keptPool.length > 0) {
					const keepMatch = modStr.match(/k(h|l)?(\d*)/);
					const dropMatch = modStr.match(/d(h|l)?(\d*)/);

					if (keepMatch) {
						const type = keepMatch[1] === "l" ? "l" : "h";
						const num = parseInt(keepMatch[2] || "1");
						keptPool.sort((a, b) => b - a);
						if (type === "h") {
							keptPool = keptPool.slice(0, num);
						} else {
							keptPool = keptPool.slice(-num);
						}
					} else if (dropMatch) {
						const type = dropMatch[1] === "h" ? "h" : "l";
						const num = parseInt(dropMatch[2] || "1");
						keptPool.sort((a, b) => b - a);
						if (type === "l") {
							keptPool = keptPool.slice(0, Math.max(0, keptPool.length - num));
						} else {
							keptPool = keptPool.slice(num);
						}
					}
				}

				for (const r of keptPool) {
					total += (r * sign);
				}
			} else if (match[6]) {
				const val = parseInt(match[6]) * sign;
				totalModifier += val;
				total += val;
			}
		}

		if (!foundAny && !compMatch) return null;

		let comparison;
		if (compMatch && compMatch[2] && compMatch[3]) {
			const op = compMatch[2];
			const target = parseInt(compMatch[3]);
			let success = false;

			if (op === ">=" || op === "≥" || op === "vs") {
				success = total >= target;
			} else if (op === "<=" || op === "≤") {
				success = total <= target;
			} else if (op === ">") {
				success = total > target;
			} else if (op === "<") {
				success = total < target;
			} else if (op === "=") {
				success = total === target;
			}

			comparison = { operator: op, target, success };
		}

		let forceFlag: "S" | "F" | undefined;
		if (original.endsWith(" S")) forceFlag = "S";
		else if (original.endsWith(" F")) forceFlag = "F";

		return {
			notation,
			total,
			rolls: originalRolls,
			modifier: totalModifier,
			sides: firstSides,
			comparison,
			forceFlag
		};
	}

	private static rollDie(sides: number | "f"): number {
		if (sides === "f") {
			return Math.floor(Math.random() * 3) - 1;
		}
		return Math.floor(Math.random() * sides) + 1;
	}
}
