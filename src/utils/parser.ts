/**
 * Lonelog Notation Parser
 * Extracts structured data from Lonelog notation in markdown files
 */


export interface ParsedEntity{
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

export interface ParsedProgress {
	type: "clock" | "track" | "timer";
	name: string;
	current: number;
	max?: number;
	line: number;
}

export interface ParsedRoom {
	id: string;
	status: string[];
	description?: string;
	exits: string[];
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface ParsedScene {
	number: string;
	context: string;
	line: number;
}

export interface ParsedItem {
	name: string;
	quantity: string;
	properties: string[];
	mentions: number[];
	firstMention: number;
	lastMention: number;
}

export interface ParsedWealth {
	currencies: Map<string, string>; // name -> quantity (e.g., "Gold" -> "45")
	line: number;
}

export interface ParsedSession {
	number: number;
	title: string;
	line: number;
	date?: string;
	scenes: ParsedScene[];
}

export interface ParsedCombatant {
	name: string;
	type: "pc" | "foe";
	stats: string[];
	line: number;
}

export interface ParsedCombatEncounter {
	id: string; // encounter start line
	startLine: number;
	endLine?: number;
	currentRound: number;
	combatants: Map<string, ParsedCombatant>;
	isClosed: boolean;
}

export interface ParsedElements {
	npcs: Map<string, ParsedEntity>;
	locations: Map<string, ParsedEntity>;
	threads: Map<string, ParsedThread>;
	pcs: Map<string, ParsedEntity>;
	rooms: Map<string, ParsedRoom>;
	inventory: Map<string, ParsedItem>;
	wealth: Map<string, string>; // Global/current wealth state
	progress: ParsedProgress[];
	sessions: ParsedSession[];
	combat: ParsedCombatEncounter[];
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
		const rooms = this.parseRooms(content);
		const progress = this.parseProgress(content);
		const sessions = this.parseSessions(content);
		const combat = this.parseCombatEncounters(content);
		const inventory = this.parseInventory(content);
		const wealth = this.parseWealth(content);

		const result: ParsedElements = { 
			npcs, locations, threads, pcs, rooms, progress, sessions, combat, inventory, wealth 
		};

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
	private static parseNPCs(content: string): Map<string, ParsedEntity> {
		const npcRegex = /\[#?N:([^\]|]+)(\|([^\]]*))?\]/g;
		const npcs = new Map<string, ParsedEntity>();

		let match;
		while ((match = npcRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			if (match.toString()[1]?.contains('#')) continue;
			this.parseEntity(match, content, npcs)
		}
		return npcs;
	}

	/**
	 * Parse location tags: [L:Name|tag1|tag2]
	 */
	private static parseLocations(
		content: string
	): Map<string, ParsedEntity> {
		const locationRegex = /\[#?L:([^\]|]+)(\|([^\]]*))?\]/g;
		const locations = new Map<string, ParsedEntity>();

		let match;
		while ((match = locationRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			if (match.toString()[1]?.contains('#')) continue;
			this.parseEntity(match, content, locations);
		}

		return locations;
	}

	/**
	 * Parse thread tags: [Thread:Name|state]
	 */
	private static parseThreads(content: string): Map<string, ParsedThread> {
		const threadRegex = /\[#?Thread:([^\]|]+)(\|([^\]]*))?\]/g;
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
	 * Parse Room tags: [R:ID|status|desc|exits] or [#R:ID]
	 */
	private static parseRooms(content: string): Map<string, ParsedRoom> {
		const roomRegex = /\[#?R:([^\]|]+)(\|([^\]]*))?\]/g;
		const rooms = new Map<string, ParsedRoom>();

		let match;
		while ((match = roomRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			const id = match[1].trim();
			const partsStr = match[3] || "";
			const parts = partsStr.split("|").map(p => p.trim());
			
			const statusPart = parts[0] || "";
			const description = parts[1] || undefined;
			const exitsStr = parts[2] || "";
			
			// Handle status (including +prefix for adding)
			let newStatuses = statusPart.split(",").map(s => s.trim()).filter(s => s);
			
			const lineNum = this.getLineNumber(content, match.index);
			
			if (rooms.has(id)) {
				const existing = rooms.get(id)!;
				existing.mentions.push(lineNum);
				existing.lastMention = lineNum;
				
				// Update status
				if (statusPart.startsWith("+")) {
					// Additive status
					const toAdd = statusPart.substring(1).split(",").map(s => s.trim()).filter(s => s);
					toAdd.forEach(s => {
						if (!existing.status.includes(s)) existing.status.push(s);
					});
				} else if (newStatuses.length > 0) {
					// Replace status
					existing.status = newStatuses;
				}
				
				if (description) existing.description = description;
				
				// Handle exits
				if (exitsStr.startsWith("exits ")) {
					const exits = exitsStr.replace("exits ", "").split(",").map(e => e.trim()).filter(e => e);
					exits.forEach(e => {
						if (!existing.exits.includes(e)) existing.exits.push(e);
					});
				}
			} else {
				// Create new room
				const exits = exitsStr.startsWith("exits ") 
					? exitsStr.replace("exits ", "").split(",").map(e => e.trim()).filter(e => e)
					: [];
					
				rooms.set(id, {
					id,
					status: newStatuses,
					description,
					exits,
					mentions: [lineNum],
					firstMention: lineNum,
					lastMention: lineNum
				});
			}
		}

		return rooms;
	}

	/**
	 * Parse PC tags: [PC:Name|tag1|tag2]
	 */
	private static parsePCs(content: string): Map<string, ParsedEntity> {
		const pcRegex = /\[#?PC:([^\]|]+)(\|([^\]]*))?\]/g;
		const pcs = new Map<string, ParsedEntity>();

		let match;
		while ((match = pcRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			if (match.toString()[1]?.contains('#')) continue;
			this.parseEntity(match, content, pcs);	
			
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
	 * Parse Inventory tags: [Inv:Item|qty|props]
	 * Supports deltas: [Inv:Item-1], [Inv:Item|3->2], etc.
	 */
	private static parseInventory(content: string): Map<string, ParsedItem> {
		const invRegex = /\[#?Inv:([^\]|]+)(\|([^\]]*))?\]/g;
		const inventory = new Map<string, ParsedItem>();

		let match;
		while ((match = invRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			const namePart = match[1].trim();
			const detailsPart = match[3] || "";

			// Handle shorthand deltas like [Inv:Torch-1] in the name field
			let name = namePart;
			let quantity = "";
			
			const deltaMatch = namePart.match(/^(.+?)([+-]\d+)$/);
			if (deltaMatch && deltaMatch[1]) {
				name = deltaMatch[1].trim();
				quantity = deltaMatch[2] || ""; // e.g. "-1"
			}

			const parts = detailsPart.split("|").map(p => p.trim());
			if (parts[0] && !deltaMatch) {
				quantity = parts[0];
			}
			const properties = parts.slice(1).filter(p => p);

			const lineNum = this.getLineNumber(content, match.index);

			if (inventory.has(name)) {
				const existing = inventory.get(name)!;
				existing.mentions.push(lineNum);
				existing.lastMention = lineNum;

				// Update quantity
				if (quantity.includes("->")) {
					existing.quantity = quantity.split("->").pop()?.trim() || existing.quantity;
				} else if (quantity.match(/^[+-]\d+$/)) {
					// Delta update if existing is numeric
					const currentVal = parseInt(existing.quantity);
					if (!isNaN(currentVal)) {
						existing.quantity = (currentVal + parseInt(quantity)).toString();
					} else {
						existing.quantity = quantity;
					}
				} else if (quantity) {
					existing.quantity = quantity;
				}

				// Merge properties
				properties.forEach(p => {
					if (!existing.properties.includes(p)) existing.properties.push(p);
				});
			} else {
				inventory.set(name, {
					name,
					quantity: quantity.includes("->") ? quantity.split("->").pop()?.trim() || "" : quantity,
					properties,
					mentions: [lineNum],
					firstMention: lineNum,
					lastMention: lineNum
				});
			}
		}

		return inventory;
	}

	/**
	 * Parse Wealth tags: [Wealth:Gold 10|Silver 5]
	 * Returns the most recent global wealth state
	 */
	private static parseWealth(content: string): Map<string, string> {
		const wealthRegex = /\[#?Wealth:([^\]]+)\]/g;
		const currentState = new Map<string, string>();

		let match;
		while ((match = wealthRegex.exec(content)) !== null) {
			if (!match[1]) continue;
			const parts = match[1].split("|").map(p => p.trim());
			
			parts.forEach(part => {
				// Match "Gold 10" or "Gold+5" or "Gold 10->15"
				const m = part.match(/^([^+\-\s>]+)\s*([+\-\d>→].*)$/);
				if (m && m[1] && m[2]) {
					const currency = m[1].trim();
					let value = m[2].trim().replace("→", "->");

					if (value.includes("->")) {
						currentState.set(currency, value.split("->").pop()?.trim() || "0");
					} else if (value.match(/^[+-]\d+$/)) {
						const currentVal = parseInt(currentState.get(currency) || "0");
						currentState.set(currency, (currentVal + parseInt(value)).toString());
					} else {
						currentState.set(currency, value);
					}
				}
			});
		}

		return currentState;
	}

	/**
	 * Parse sessions and scenes: ## Session X, ### S1
	 */
	private static parseSessions(content: string): ParsedSession[] {
		const lines = content.split("\n");
		const sessions: ParsedSession[] = [];
		let currentSession: ParsedSession | null = null;

		lines.forEach((line, index) => {
			// Match session header: ## Session 1
			const sessionMatch = line.match(/^##\s+Session\s+(\d+)(.*)$/);
			if (sessionMatch && sessionMatch[1]) {
				if (currentSession) {
					sessions.push(currentSession);
				}

				const sessionNum = sessionMatch[1];
				const sessionExtra = sessionMatch[2] || "";

				currentSession = {
					number: parseInt(sessionNum),
					title: sessionExtra.trim() || `Session ${sessionNum}`,
					line: index,
					scenes: [],
				};

				// Try to extract date from next line
				if (index + 1 < lines.length) {
					const nextLine = lines[index + 1];
					if (nextLine) {
						const dateMatch = nextLine.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);
						if (dateMatch && dateMatch[1]) {
							currentSession.date = dateMatch[1];
						}
					}
				}
				return;
			}

			// Match scene marker: ### S1 *context* or ### T1-S1 *context*
			// Regex supports S1, S1a, T1-S1, etc.
			const sceneMatch = line.match(/^###\s+([A-Z\d.-]+)\s*\*([^*]*)\*/);
			if (sceneMatch && sceneMatch[1] && currentSession) {
				currentSession.scenes.push({
					number: sceneMatch[1],
					context: sceneMatch[2]?.trim() || "Scene",
					line: index,
				});
				return;
			}

			// Also match simpler scene format: ### S1
			const simpleSceneMatch = line.match(/^###\s+([A-Z\d.-]+)(?:\s+(.*))?$/);
			if (
				simpleSceneMatch &&
				simpleSceneMatch[1] &&
				currentSession &&
				!sceneMatch
			) {
				const sceneNumber = simpleSceneMatch[1];
				currentSession.scenes.push({
					number: sceneNumber,
					context: simpleSceneMatch[2]?.trim() || "Scene",
					line: index,
				});
			}
		});

		// Don't forget the last session
		if (currentSession) {
			sessions.push(currentSession);
		}

		return sessions;
	}

	/**
	 * Parse combat encounters: [COMBAT], [/COMBAT], Rd#, [F:], [PC:]
	 */
	private static parseCombatEncounters(content: string): ParsedCombatEncounter[] {
		const lines = content.split("\n");
		const encounters: ParsedCombatEncounter[] = [];
		let currentEncounter: ParsedCombatEncounter | null = null;

		lines.forEach((line, index) => {

			// Detect Combat start or block start
			// Supports both [COMBAT] on its own or ### scene header [COMBAT]
			const combatStartMatch = line.match(/\[COMBAT\]/i);
			if (combatStartMatch) {
				// If already in an encounter, close the previous one
				if (currentEncounter) {
					currentEncounter.endLine = index - 1;
					currentEncounter.isClosed = true;
					encounters.push(currentEncounter);
				}

				currentEncounter = {
					id: `combat-${index}`,
					startLine: index,
					currentRound: 1,
					combatants: new Map<string, ParsedCombatant>(),
					isClosed: false,
				};
				return;
			}

			// Detect Combat end
			if (line.match(/\[\/COMBAT\]/i) && currentEncounter) {
				currentEncounter.endLine = index;
				currentEncounter.isClosed = true;
				encounters.push(currentEncounter);
				currentEncounter = null;
				return;
			}

			// If in a combat block, parse rounds and combatants
			if (currentEncounter) {
				// Round markers: Rd1, Rd2
				const roundMatch = line.match(/^Rd(\d+)\b/i);
				if (roundMatch && roundMatch[1]) {
					currentEncounter.currentRound = parseInt(roundMatch[1]);
				}

				// Combatant tags: [F:...] and [PC:...]
				// We'll scan the whole line for multiple tags
				const tagRegex = /\[(PC|F):([^\]|]+)(?:\|([^\]]*))?\]/gi;
				let m;
				while ((m = tagRegex.exec(line)) !== null) {
					if (!m[1] || !m[2]) continue;
					const type = m[1].toUpperCase() === "PC" ? "pc" : "foe";
					const name = m[2].trim();
					const statsStr = m[3] || "";
					const stats = statsStr.split("|").map(s => s.trim()).filter(s => s);

					// In combat, we care about the LATEST stats for a name in this encounter
					currentEncounter.combatants.set(name, {
						name,
						type,
						stats,
						line: index
					});
				}

				// Also detect if a new scene/session starts, which closes header-level combat
				if (line.match(/^#{2,3}\s+/) && currentEncounter.startLine !== index) {
					currentEncounter.endLine = index - 1;
					currentEncounter.isClosed = true;
					encounters.push(currentEncounter);
					currentEncounter = null;
				}
			}
		});

		if (currentEncounter) {
			encounters.push(currentEncounter);
		}

		return encounters;
	}

	private static parseEntity(match: any, content: string, entity: Map<string, ParsedEntity>){
		const name = match[1].trim();
		const tagsStr = match[3] || "";
		const tags = tagsStr
			.split("|")
			.map((t: string) => t.trim())
			.filter((t: string) => t);


		// Find line number
		const lineNum = this.getLineNumber(content, match.index);

		if (entity.has(name)) {
			// Update existing entry
			const existing = entity.get(name)!;
			existing.mentions.push(lineNum);
			existing.lastMention = lineNum;

			// When an NPC is updated, update tags depending on symbol:
			// - '-' removes a tag
			// - '+' adds a tag
			// - '->' replaces a tag (e.g. "tag1->tag2" replaces "tag1" with "tag2")
			// - If no symbol, replace all tags with the new set
			const newTags: Array<string> = []

			tags.forEach((tag: string) => {
				if(tag.contains('->')){
					const tagText: string[] = tag.split('->');
					if (tagText[0] !== undefined && tagText[1] !== undefined) {
						const changedIndex: number = existing.tags.indexOf(tagText[0].trim());
						if (changedIndex !== -1) {
							existing.tags[changedIndex] = tagText[1].trim();
						}
					}
				} else if (tag[0]?.contains('+')) {
					existing.tags.push(tag.slice(1, tag.length));
				} else if (tag[0]?.contains('-')) {
					const tagText = tag.slice(1, tag.length);
					const removeIndex = existing.tags.indexOf(tagText);
					existing.tags.splice(removeIndex, 1);
				}else{
					newTags.push(tag)
				} 
			});

			if (newTags.length !== 0) {
				existing.tags = newTags;
			};
		} else {
			// Create new entry
			 entity.set(name, {
				name,
				tags,
				mentions: [lineNum],
				firstMention: lineNum,
				lastMention: lineNum,
			});
		}	
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
