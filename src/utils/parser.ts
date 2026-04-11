/**
 * Lonelog Notation Parser
 * Extracts structured data from Lonelog notation in markdown files
 */

export interface ParsedNPC {
	name: string;
	tags: string[];
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface ParsedLocation {
	name: string;
	tags: string[];
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface ParsedThread {
	name: string;
	state: string;
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface ParsedPC {
	name: string;
	tags: string[];
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface ParsedProgress {
	type: "clock" | "track" | "timer";
	name: string;
	current: number;
	max?: number;
	line: number;
}

export interface ParsedElements {
	npcs: Map<string, ParsedNPC>;
	locations: Map<string, ParsedLocation>;
	threads: Map<string, ParsedThread>;
	pcs: Map<string, ParsedPC>;
	progress: ParsedProgress[];
}

export class NotationParser {
	private static cache: {
		content: string;
		result: ParsedElements;
	} | null = null;

	/**
	 * Parse all Lonelog notation elements from content
	 * Results are cached based on content hash
	 */
	static parse(content: string): ParsedElements {
		// Check cache
		if (this.cache && this.cache.content === content) {
			return this.cache.result;
		}

		const npcs = this.parseNPCs(content);
		const locations = this.parseLocations(content);
		const threads = this.parseThreads(content);
		const pcs = this.parsePCs(content);
		const progress = this.parseProgress(content);

		const result = { npcs, locations, threads, pcs, progress };

		// Update cache
		this.cache = { content, result };

		return result;
	}

	/**
	 * Clear the parser cache (call when document changes)
	 */
	static clearCache(): void {
		this.cache = null;
	}

	/**
	 * Parse NPC tags: [N:Name|tag1|tag2]
	 */
	private static parseNPCs(content: string): Map<string, ParsedNPC> {
		const npcRegex = /\[N:([^\]|]+)(\|([^\]]*))?\]/g;
		const npcs = new Map<string, ParsedNPC>();

		let match;
		while ((match = npcRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			const name = match[1].trim();
			const tagsStr = match[3] || "";
			const tags = tagsStr
				.split("|")
				.map((t) => t.trim())
				.filter((t) => t);

			// Find line number
			const lineNum = this.getLineNumber(content, match.index);

			if (npcs.has(name)) {
				// Update existing entry
				const existing = npcs.get(name)!;
				existing.mentions.push(lineNum);
				existing.lastMention = lineNum;
				// Merge tags (keep unique)
				tags.forEach((tag) => {
					if (!existing.tags.includes(tag)) {
						existing.tags.push(tag);
					}
				});
			} else {
				// Create new entry
				npcs.set(name, {
					name,
					tags,
					mentions: [lineNum],
					firstMention: lineNum,
					lastMention: lineNum,
				});
			}
		}

		return npcs;
	}

	/**
	 * Parse location tags: [L:Name|tag1|tag2]
	 */
	private static parseLocations(
		content: string
	): Map<string, ParsedLocation> {
		const locationRegex = /\[L:([^\]|]+)(\|([^\]]*))?\]/g;
		const locations = new Map<string, ParsedLocation>();

		let match;
		while ((match = locationRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			const name = match[1].trim();
			const tagsStr = match[3] || "";
			const tags = tagsStr
				.split("|")
				.map((t) => t.trim())
				.filter((t) => t);

			const lineNum = this.getLineNumber(content, match.index);

			if (locations.has(name)) {
				const existing = locations.get(name)!;
				existing.mentions.push(lineNum);
				existing.lastMention = lineNum;
				tags.forEach((tag) => {
					if (!existing.tags.includes(tag)) {
						existing.tags.push(tag);
					}
				});
			} else {
				locations.set(name, {
					name,
					tags,
					mentions: [lineNum],
					firstMention: lineNum,
					lastMention: lineNum,
				});
			}
		}

		return locations;
	}

	/**
	 * Parse thread tags: [Thread:Name|state]
	 */
	private static parseThreads(content: string): Map<string, ParsedThread> {
		const threadRegex = /\[Thread:([^\]|]+)(\|([^\]]*))?\]/g;
		const threads = new Map<string, ParsedThread>();

		let match;
		while ((match = threadRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			const name = match[1].trim();
			const state = match[3]?.trim() || "Open";

			const lineNum = this.getLineNumber(content, match.index);

			if (threads.has(name)) {
				const existing = threads.get(name)!;
				existing.mentions.push(lineNum);
				existing.lastMention = lineNum;
				// Update state to most recent
				existing.state = state;
			} else {
				threads.set(name, {
					name,
					state,
					mentions: [lineNum],
					firstMention: lineNum,
					lastMention: lineNum,
				});
			}
		}

		return threads;
	}

	/**
	 * Parse PC tags: [PC:Name|tag1|tag2]
	 */
	private static parsePCs(content: string): Map<string, ParsedPC> {
		const pcRegex = /\[PC:([^\]|]+)(\|([^\]]*))?\]/g;
		const pcs = new Map<string, ParsedPC>();

		let match;
		while ((match = pcRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			const name = match[1].trim();
			const tagsStr = match[3] || "";
			const tags = tagsStr
				.split("|")
				.map((t) => t.trim())
				.filter((t) => t);

			const lineNum = this.getLineNumber(content, match.index);

			if (pcs.has(name)) {
				const existing = pcs.get(name)!;
				existing.mentions.push(lineNum);
				existing.lastMention = lineNum;
				tags.forEach((tag) => {
					if (!existing.tags.includes(tag)) {
						existing.tags.push(tag);
					}
				});
			} else {
				pcs.set(name, {
					name,
					tags,
					mentions: [lineNum],
					firstMention: lineNum,
					lastMention: lineNum,
				});
			}
		}

		return pcs;
	}

	/**
	 * Parse progress elements: clocks, tracks, timers
	 */
	private static parseProgress(content: string): ParsedProgress[] {
		const progress: ParsedProgress[] = [];

		// Event Clocks: [E:Name X/Y] or [Clock:Name X/Y]
		// Supports inline update: [Clock:Name X/Y ->newX/newY]
		const clockRegex = /\[(?:E|Clock):([^\]]+?)\s+(\d+)\/(\d+)(?:\s*->\s*(\d+)\/(\d+))?\]/g;
		let match;
		while ((match = clockRegex.exec(content)) !== null) {
			if (!match[1] || !match[2] || !match[3]) continue;
			const name = match[1].trim();
			// If inline update present, use the updated values
			const current = match[4] !== undefined ? parseInt(match[4]) : parseInt(match[2]);
			const max = match[5] !== undefined ? parseInt(match[5]) : parseInt(match[3]);
			const line = this.getLineNumber(content, match.index);

			progress.push({
				type: "clock",
				name,
				current,
				max,
				line,
			});
		}

		// Tracks: [Track:Name X/Y]
		// Supports inline update: [Track:Name X/Y ->newX/newY]
		const trackRegex = /\[Track:([^\]]+?)\s+(\d+)\/(\d+)(?:\s*->\s*(\d+)\/(\d+))?\]/g;
		while ((match = trackRegex.exec(content)) !== null) {
			if (!match[1] || !match[2] || !match[3]) continue;
			const name = match[1].trim();
			const current = match[4] !== undefined ? parseInt(match[4]) : parseInt(match[2]);
			const max = match[5] !== undefined ? parseInt(match[5]) : parseInt(match[3]);
			const line = this.getLineNumber(content, match.index);

			progress.push({
				type: "track",
				name,
				current,
				max,
				line,
			});
		}

		// Timers: [Timer:Name X]
		// Supports inline update: [Timer:Name X ->newX]
		const timerRegex = /\[Timer:([^\]]+?)\s+(\d+)(?:\s*->\s*(\d+))?\]/g;
		while ((match = timerRegex.exec(content)) !== null) {
			if (!match[1] || !match[2]) continue;
			const name = match[1].trim();
			const current = match[3] !== undefined ? parseInt(match[3]) : parseInt(match[2]);
			const line = this.getLineNumber(content, match.index);

			progress.push({
				type: "timer",
				name,
				current,
				line,
			});
		}

		// Deduplicate: keep only the LAST occurrence of each type+name combo.
		// When the same tracker appears multiple times across scenes/sessions,
		// the panel shows only the most recent value.
		const seen = new Map<string, ParsedProgress>();
		for (const item of progress) {
			seen.set(`${item.type}:${item.name}`, item);
		}

		return Array.from(seen.values());
	}

	/**
	 * Get line number from character index
	 */
	private static getLineNumber(content: string, index: number): number {
		const upToIndex = content.substring(0, index);
		return upToIndex.split("\n").length - 1;
	}

	/**
	 * Get all entity names for auto-completion
	 */
	static getAllNames(
		parsedElements: ParsedElements,
		type: "npc" | "location" | "thread" | "pc"
	): string[] {
		switch (type) {
			case "npc":
				return Array.from(parsedElements.npcs.keys());
			case "location":
				return Array.from(parsedElements.locations.keys());
			case "thread":
				return Array.from(parsedElements.threads.keys());
			case "pc":
				return Array.from(parsedElements.pcs.keys());
			default:
				return [];
		}
	}

	/**
	 * Get suggestions for a specific entity name
	 */
	static getSuggestions(
		parsedElements: ParsedElements,
		type: "npc" | "location" | "thread" | "pc",
		query: string
	): string[] {
		const names = this.getAllNames(parsedElements, type);
		const lowerQuery = query.toLowerCase();

		// Filter by query and sort by relevance
		return names
			.filter((name) => name.toLowerCase().includes(lowerQuery))
			.sort((a, b) => {
				// Exact matches first
				const aExact = a.toLowerCase() === lowerQuery;
				const bExact = b.toLowerCase() === lowerQuery;
				if (aExact && !bExact) return -1;
				if (!aExact && bExact) return 1;

				// Starts with query next
				const aStarts = a.toLowerCase().startsWith(lowerQuery);
				const bStarts = b.toLowerCase().startsWith(lowerQuery);
				if (aStarts && !bStarts) return -1;
				if (!aStarts && bStarts) return 1;

				// Alphabetical
				return a.localeCompare(b);
			});
	}
}
