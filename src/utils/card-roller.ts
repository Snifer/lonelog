/**
 * Card Roller Utility
 * Handles parsing and generating card draws for Lonelog notation
 */

export class CardRoller {
	static readonly STANDARD_SUITS: Record<string, string> = { "h": "Hearts", "d": "Diamonds", "c": "Clubs", "s": "Spades" };
	static readonly STANDARD_RANKS: Record<string, string> = { "A": "Ace", "2": "Two", "3": "Three", "4": "Four", "5": "Five", "6": "Six", "7": "Seven", "8": "Eight", "9": "Nine", "10": "Ten", "J": "Jack", "Q": "Queen", "K": "King" };
	
	static readonly TAROT_MINOR_SUITS: Record<string, string> = { "Wa": "Wands", "Cu": "Cups", "Sw": "Swords", "Pe": "Pentacles" };
	static readonly TAROT_MINOR_RANKS: Record<string, string> = { "A": "Ace", "2": "Two", "3": "Three", "4": "Four", "5": "Five", "6": "Six", "7": "Seven", "8": "Eight", "9": "Nine", "10": "Ten", "Pg": "Page", "Kn": "Knight", "Q": "Queen", "K": "King" };
	
	static readonly TAROT_MAJORS = [
		"The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor", 
		"The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit", 
		"Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance", 
		"The Devil", "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World"
	];

	/**
	 * Draws a standard playing card
	 */
	static drawStandard(includeDescription: boolean = true): string {
		const rand = Math.random() * 54;
		if (rand < 2) {
			return rand < 1 ? "RJkr // Red Joker" : "BJkr // Black Joker";
		}
		
		const suitKeys = Object.keys(this.STANDARD_SUITS);
		const rankKeys = Object.keys(this.STANDARD_RANKS);

		const suitKey = suitKeys[Math.floor(Math.random() * suitKeys.length)];
		if (suitKey !== undefined) {
			const rankKey = rankKeys[Math.floor(Math.random() * rankKeys.length)];
			if (rankKey !== undefined) {
				return `${rankKey}${suitKey}${includeDescription ? ` // ${this.STANDARD_RANKS[rankKey]} of ${this.STANDARD_SUITS[suitKey]}` : ""}`;
			}
		}
		return includeDescription ? "Jkr // Joker" : "Jkr";
	}

	/**
	 * Draws a tarot card
	 */
	static drawTarot(includeDescription: boolean = true): string {
		const isMajor = Math.random() < (22 / 78);
		let card = "";
		let explanation = "";
		
		if (isMajor) {
			const n = Math.floor(Math.random() * 22);
			card = `M${n}`;
			explanation = this.TAROT_MAJORS[n] ?? "";
		} else {
			const suitKeys = Object.keys(this.TAROT_MINOR_SUITS);
			const rankKeys = Object.keys(this.TAROT_MINOR_RANKS);

			const suitKey = suitKeys[Math.floor(Math.random() * suitKeys.length)];
			if (suitKey !== undefined) {
				const rankKey = rankKeys[Math.floor(Math.random() * rankKeys.length)];
				if (rankKey !== undefined) {
					card = `${rankKey}${suitKey}`;
					explanation = `${this.TAROT_MINOR_RANKS[rankKey]} of ${this.TAROT_MINOR_SUITS[suitKey]}`;
				}
			}
		}

		// 30% chance reversed
		if (Math.random() < 0.3) {
			card += "r";
			explanation += " reversed";
		}

		return card + (includeDescription && explanation ? " // " + explanation : "");
	}

	/**
	 * Checks if notation is a recognized card drawing command in base format
	 * e.g., "d: draw", "d: Past=tarot"
	 */
	static extractCardRequests(line: string): { original: string, isTarot: boolean, prefix: string }[] {
		const results: { original: string, isTarot: boolean, prefix: string }[] = [];
		
		const dMatch = /^\s*(d:|\?|tbl:|gen:)\s*/i.exec(line);
		let basePrefix = dMatch ? dMatch[0] : "";
		if (!basePrefix) {
			const labelMatch = /^(\s*[^:([]+:\s*)/i.exec(line);
			if (labelMatch) basePrefix = labelMatch[0];
		}
		if (!basePrefix) return results;

		const arrowIndex = line.indexOf("->");
		const content = arrowIndex !== -1 ? line.substring(basePrefix.length, arrowIndex).trim() : line.substring(basePrefix.length).trim();

		const segments = content.split(/,\s+/);
		
		for (const seg of segments) {
			const eqIndex = seg.indexOf("=");
			const base = eqIndex !== -1 ? seg.substring(eqIndex + 1).trim().toLowerCase() : seg.trim().toLowerCase();
			const varName = eqIndex !== -1 ? seg.substring(0, eqIndex).trim() : base;

			if (base === "draw" || base === "deck" || base === "card" || base === "cards" || base === "tarot") {
				results.push({
					original: seg,
					isTarot: base === "tarot",
					prefix: varName
				});
			}
		}

		return results;
	}

	/**
	 * Processes the line replacing draw/tarot keywords with generated cards
	 */
	static processLine(line: string, includeDescription: boolean = true): string | null {
		const requests = this.extractCardRequests(line);
		if (requests.length === 0) return null;

		const dMatch = /^\s*(d:|\?|tbl:|gen:)\s*/i.exec(line);
		let basePrefix = dMatch ? dMatch[0] : "";
		if (!basePrefix) {
			const labelMatch = /^(\s*[^:([]+:\s*)/i.exec(line);
			if (labelMatch) basePrefix = labelMatch[0];
		}
		
		const arrowIndex = line.indexOf("->");
		const outcome = arrowIndex !== -1 ? line.substring(arrowIndex) : "";
		const content = arrowIndex !== -1 ? line.substring(basePrefix.length, arrowIndex).trim() : line.substring(basePrefix.length).trim();

		const segments = content.split(/,\s+/);
		
		for (const req of requests) {
			const drawn = req.isTarot ? this.drawTarot(includeDescription) : this.drawStandard(includeDescription);
			
			const eqIndex = req.original.indexOf("=");
			let toReplace = "";
			if (eqIndex !== -1) {
				const varName = req.original.substring(0, eqIndex).trim();
				toReplace = `${varName}=${drawn}`;
			} else {
				toReplace = `draw=${drawn}`;
			}

			// Replace it in segments
			for (let i = 0; i < segments.length; i++) {
				if (segments[i] === req.original) {
					segments[i] = toReplace;
				}
			}
		}

		return `${basePrefix}${segments.join(", ")}${outcome ? " " + outcome : ""}`;
	}
}
