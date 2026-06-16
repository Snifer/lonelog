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
	slotParent?: string;
    isContainer: boolean;
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
			if (match[0]?.startsWith("[#")) continue;
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
			if (match[0]?.startsWith("[#")) continue;
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
			if (match[0]?.startsWith("[#")) continue;
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
		// Supports fractional values: [Track:Name 1.5/10] or [Track:Name 0.25/10 ->0.5/10]
		const trackRegex = /\[Track:([^\]]+?)\s+(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(?:\s*->\s*(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?))?\]/g;
		while ((match = trackRegex.exec(content)) !== null) {
			if (!match[1] || !match[2] || !match[3]) continue;
			const name = match[1].trim();
			const current = match[4] !== undefined ? parseFloat(match[4]) : parseFloat(match[2]);
			const max = match[5] !== undefined ? parseFloat(match[5]) : parseFloat(match[3]);
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
			
			const deltaMatch = namePart.match(/^(.+?)\s*([+-]\d+)$/);
			if (deltaMatch && deltaMatch[1]) {
				name = deltaMatch[1].trim();
				quantity = deltaMatch[2] || ""; // e.g. "-1"
			} else {
				const bundleMatch = this.parseInventoryBundleName(namePart);
				if (bundleMatch) {
					name = bundleMatch.name;
					quantity = bundleMatch.quantity;
				}
			}

			const parts = detailsPart.split("|").map(p => p.trim());
			const lineNum = this.getLineNumber(content, match.index);

			if (this.parseInventorySlot(inventory, name, parts, lineNum)) continue;

			if (parts[0] && !deltaMatch) {
				quantity = parts[0].replace(/→/g, "->");;
			}
			const properties = parts.slice(1).filter(p => p);

			if (quantity.match(/^[+-]\d+$/)) {
				const handled = this.applyInventoryDelta(inventory, name, parseInt(quantity), lineNum);
				if (handled) {
					if (properties.length > 0) {
						this.applyInventoryPropertyUpdates(inventory, name, properties);
					}
					continue;
				}
			}

			if (quantity.match(/^\d+$/) || quantity === "depleted") {
				const handled = this.applyInventoryAbsoluteQuantity(inventory, name, quantity, lineNum);
				if (handled) {
					if (properties.length > 0) {
						this.applyInventoryPropertyUpdates(inventory, name, properties);
					}
					continue;
				}
			}

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
				existing.properties = this.mergeEntityTags(existing.properties, properties);
			} else {
				inventory.set(name, {
					name,
					quantity: quantity.includes("->") ? quantity.split("->").pop()?.trim() || "" : quantity,
					properties,
					mentions: [lineNum],
					firstMention: lineNum,
					lastMention: lineNum,
					isContainer: false
				});
			}
		}

		return inventory;
	}

	/**
	 * Handle slot-based inventory notation.
	 * Returns true if the tag was handled as a slot, false otherwise.
	 *
	 * Supports:
	 *   [Inv:Backpack 1|Torch×6]        — container with multiplier sub-items
	 *   [Inv:Slot 1|Short Sword]         — container with unique item
	 *   [Inv:Slot 4|empty]               — explicit empty container
	 *   [Inv:Backpack 1|+Pickaxe]        — add item to container
	 *   [Inv:Backpack 1|-Pickaxe]        — remove item from container
	 *   [Inv:Backpack 1|Pickaxe->Shovel] — replace item in container
	 */
	private static parseInventorySlot(
	    inventory: Map<string, ParsedItem>,
	    name: string,
	    parts: string[],
	    lineNum: number
	): boolean {
	    const SLOT_CONTENT_SKIP = new Set(["empty", "depleted"]);
	    const isSlotName = /^.+\s+\d+$/i.test(name) || /^(left|right|main|off)\s+hand$/i.test(name);

	    if (!isSlotName || !parts[0]) return false;

	    const slotMultiplierRe = /^[A-Za-z].+?\s*×\s*\d+/;
	    const isSlotMultiplier = slotMultiplierRe.test(parts[0]);

	    const isSlotUnique =
	        !isSlotMultiplier &&
	        !parts[0].match(/^\d/) &&
	        !parts[0].startsWith("+") &&
	        !parts[0].startsWith("-") &&
	        !parts[0].includes("->") &&
	        !parts[0].includes("→") &&
	        !SLOT_CONTENT_SKIP.has(parts[0].toLowerCase());

	    const isSlotMutation =
	        !isSlotMultiplier &&
	        !isSlotUnique &&
	        !parts[0].match(/^\d/) &&
	        !SLOT_CONTENT_SKIP.has(parts[0].toLowerCase());

	    if (isSlotMultiplier) {
	        this.upsertSlotContainer(inventory, name, parts.slice(1), lineNum);
	        const subItemRe = /([^,×]+?)\s*×\s*(\d+)/g;
	        let sub;
	        while ((sub = subItemRe.exec(parts[0])) !== null) {
	            const subName = sub[1].trim();
	            const subQty = sub[2];
	            if (inventory.has(subName)) {
	                const existing = inventory.get(subName)!;
	                existing.mentions.push(lineNum);
	                existing.lastMention = lineNum;
	                existing.quantity = subQty;
	            } else {
	                inventory.set(subName, {
	                    name: subName, quantity: subQty, properties: parts.slice(1).filter(p => p),
	                    mentions: [lineNum], firstMention: lineNum, lastMention: lineNum,
	                    slotParent: name, isContainer: false,
	                });
	            }
	        }
	        return true;
	    }

	    if (isSlotUnique) {
	        this.upsertSlotContainer(inventory, name, [], lineNum);
	        const itemName = parts[0];
	        const itemProps = parts.slice(1).filter(p => p);
	        if (!inventory.has(itemName)) {
	            inventory.set(itemName, {
	                name: itemName, quantity: "1", properties: itemProps,
	                mentions: [lineNum], firstMention: lineNum, lastMention: lineNum,
	                slotParent: name, isContainer: false,
	            });
	        } else {
	            const existing = inventory.get(itemName)!;
	            existing.mentions.push(lineNum);
	            existing.lastMention = lineNum;
	        }
	        return true;
	    }

	    if (SLOT_CONTENT_SKIP.has(parts[0].toLowerCase())) {
	        this.upsertSlotContainer(inventory, name, [], lineNum);
	        return true;
	    }

	    if (isSlotMutation) {
	        const mutation = parts[0];
	        if (mutation.startsWith("+")) {
	            const itemName = mutation.slice(1).trim();
	            if (!inventory.has(itemName)) {
	                inventory.set(itemName, {
	                    name: itemName, quantity: "1", properties: parts.slice(1).filter(p => p),
	                    mentions: [lineNum], firstMention: lineNum, lastMention: lineNum,
	                    slotParent: name, isContainer: false,
	                });
	            }
	        } else if (mutation.startsWith("-")) {
	            const itemName = mutation.slice(1).trim();
	            inventory.delete(itemName);
	        } else if (mutation.includes("->") || mutation.includes("→")) {
	            const [from, to] = mutation.replace(/→/g, "->").split("->").map(s => s.trim());
	            if (from && to && inventory.has(from)) {
	                const existing = inventory.get(from)!;
	                inventory.delete(from);
	                inventory.set(to, {
	                    ...existing,
	                    name: to,
	                    mentions: [...existing.mentions, lineNum],
	                    lastMention: lineNum,
	                });
	            }
	        }
	        return true;
	    }

	    return false;
	}

	private static upsertSlotContainer(
	    inventory: Map<string, ParsedItem>,
	    name: string,
	    properties: string[],
	    lineNum: number
	): void {
	    if (!inventory.has(name)) {
	        inventory.set(name, {
	            name, quantity: "", properties,
	            mentions: [lineNum], firstMention: lineNum, lastMention: lineNum,
	            isContainer: true,
	        });
	    } else {
	        const existing = inventory.get(name)!;
	        existing.mentions.push(lineNum);
	        existing.lastMention = lineNum;
	    }
	}

	private static applyInventoryDelta(
		inventory: Map<string, ParsedItem>,
		targetName: string,
		delta: number,
		lineNum: number
	): boolean {
		const candidates = this.findInventoryQuantityCandidates(inventory, targetName);

		if (candidates.length === 0) return false;

		candidates.sort((a, b) => a.item.firstMention - b.item.firstMention);

		if (delta > 0) {
			const nestedCandidate = candidates.find(candidate => candidate.type === "nested");
			const targetCandidate = nestedCandidate || candidates.find(candidate => candidate.type === "direct");
			if (!targetCandidate) return false;

			this.updateInventoryCandidateQuantity(targetCandidate, targetCandidate.amount + delta);
			targetCandidate.item.mentions.push(lineNum);
			targetCandidate.item.lastMention = lineNum;
			return true;
		}

		let remaining = Math.abs(delta);

		for (const candidate of candidates) {
			if (remaining <= 0) break;

			const consumed = Math.min(candidate.amount, remaining);
			const nextAmount = candidate.amount - consumed;

			this.updateInventoryCandidateQuantity(candidate, nextAmount);
			candidate.item.mentions.push(lineNum);
			candidate.item.lastMention = lineNum;
			remaining -= consumed;
		}

		return true;
	}

	private static applyInventoryAbsoluteQuantity(
		inventory: Map<string, ParsedItem>,
		targetName: string,
		quantity: string,
		lineNum: number
	): boolean {
		const candidates = this.findInventoryQuantityCandidates(inventory, targetName);
		if (candidates.length === 0) return false;

		candidates.sort((a, b) => a.item.firstMention - b.item.firstMention);

		const targetAmount = quantity === "depleted" ? 0 : parseInt(quantity);
		if (isNaN(targetAmount)) return false;

		let remaining = targetAmount;

		candidates.forEach((candidate, index) => {
			const nextAmount = index === 0 ? remaining : 0;
			this.updateInventoryCandidateQuantity(candidate, nextAmount);
			candidate.item.mentions.push(lineNum);
			candidate.item.lastMention = lineNum;
			remaining = 0;
		});

		return true;
	}

	private static applyInventoryPropertyUpdates(
		inventory: Map<string, ParsedItem>,
		targetName: string,
		properties: string[]
	): void {
		const directItem = inventory.get(targetName);
		if (!directItem) return;

		directItem.properties = this.mergeEntityTags(directItem.properties, properties);
	}

	private static findInventoryQuantityCandidates(
		inventory: Map<string, ParsedItem>,
		targetName: string
	): Array<{
		item: ParsedItem;
		amount: number;
		type: "direct" | "nested";
		nestedName?: string;
		multiplier?: string;
	}> {
		const candidates: Array<{
			item: ParsedItem;
			amount: number;
			type: "direct" | "nested";
			nestedName?: string;
			multiplier?: string;
		}> = [];

		inventory.forEach(item => {
			if (item.name === targetName && item.quantity.match(/^\d+$/)) {
				candidates.push({ item, amount: parseInt(item.quantity), type: "direct" });
				return;
			}

			const nested = this.parseNestedInventoryQuantity(item.quantity);
			if (nested && nested.name === targetName) {
				candidates.push({
					item,
					amount: nested.amount,
					type: "nested",
					nestedName: nested.name,
					multiplier: nested.multiplier,
				});
			}
		});

		return candidates;
	}

	private static updateInventoryCandidateQuantity(
		candidate: {
			item: ParsedItem;
			amount: number;
			type: "direct" | "nested";
			nestedName?: string;
			multiplier?: string;
		},
		nextAmount: number
	): void {
		if (candidate.type === "direct") {
			candidate.item.quantity = Math.max(0, nextAmount).toString();
			return;
		}

		candidate.item.quantity = nextAmount > 0
			? `${candidate.nestedName}${candidate.multiplier}${nextAmount}`
			: "empty";
	}

	private static parseNestedInventoryQuantity(
		quantity: string
	): { name: string; amount: number; multiplier: string } | null {
		const match = quantity.trim().match(/^(.+?)\s*([×x])\s*(\d+)$/);
		if (!match || !match[1] || !match[2] || !match[3]) return null;

		return {
			name: match[1].trim(),
			amount: parseInt(match[3]),
			multiplier: match[2],
		};
	}

	private static parseInventoryBundleName(
		namePart: string
	): { name: string; quantity: string } | null {
		const match = namePart.trim().match(/^(.+?)\s*([×x])\s*(\d+)$/);
		if (!match || !match[1] || !match[3]) return null;

		return {
			name: match[1].trim(),
			quantity: match[3],
		};
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
					} else if (value.match(/^[+-]\d+(?:\.\d+)?$/)) {
						const currentVal = currentState.get(currency) || "0";
						const nextVal = this.addSignedDecimalStrings(currentVal, value);
						currentState.set(currency, nextVal ?? value);
					} else {
						currentState.set(currency, value);
					}
				}
			});
		}

		return currentState;
	}

	private static addSignedDecimalStrings(base: string, delta: string): string | null {
		const parsedBase = this.parseDecimalString(base);
		const parsedDelta = this.parseDecimalString(delta);

		if (!parsedBase || !parsedDelta) return null;

		const scale = Math.max(parsedBase.scale, parsedDelta.scale);
		const scaledBase = parsedBase.digits + "0".repeat(scale - parsedBase.scale);
		const scaledDelta = parsedDelta.digits + "0".repeat(scale - parsedDelta.scale);

		let negative = false;
		let digits = "0";

		if (parsedBase.negative === parsedDelta.negative) {
			negative = parsedBase.negative;
			digits = this.addIntegerStrings(scaledBase, scaledDelta);
		} else {
			const comparison = this.compareIntegerStrings(scaledBase, scaledDelta);
			if (comparison === 0) {
				return "0";
			}

			if (comparison > 0) {
				negative = parsedBase.negative;
				digits = this.subtractIntegerStrings(scaledBase, scaledDelta);
			} else {
				negative = parsedDelta.negative;
				digits = this.subtractIntegerStrings(scaledDelta, scaledBase);
			}
		}

		return this.formatScaledDecimal(negative, digits, scale);
	}

	private static parseDecimalString(value: string): { negative: boolean; digits: string; scale: number } | null {
		const match = value.trim().match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
		if (!match || !match[2]) return null;

		const integerPart = match[2];
		const fractionalPart = match[3] || "";
		const digits = this.trimLeadingZeros(`${integerPart}${fractionalPart}` || "0");

		return {
			negative: match[1] === "-" && digits !== "0",
			digits,
			scale: fractionalPart.length,
		};
	}

	private static formatScaledDecimal(negative: boolean, digits: string, scale: number): string {
		if (scale === 0) return `${negative ? "-" : ""}${digits}`;

		const paddedDigits = digits.padStart(scale + 1, "0");
		const sign = negative && digits !== "0" ? "-" : "";
		const normalizedDigits = paddedDigits;
		const integerPart = normalizedDigits.slice(0, -scale) || "0";
		const fractionalPart = normalizedDigits.slice(-scale).replace(/0+$/, "");

		return fractionalPart ? `${sign}${integerPart}.${fractionalPart}` : `${sign}${integerPart}`;
	}

	private static addIntegerStrings(a: string, b: string): string {
		let carry = 0;
		let result = "";
		let i = a.length - 1;
		let j = b.length - 1;

		while (i >= 0 || j >= 0 || carry > 0) {
			const digitA = i >= 0 ? Number(a[i]) : 0;
			const digitB = j >= 0 ? Number(b[j]) : 0;
			const sum = digitA + digitB + carry;
			result = String(sum % 10) + result;
			carry = Math.floor(sum / 10);
			i--;
			j--;
		}

		return this.trimLeadingZeros(result);
	}

	private static subtractIntegerStrings(a: string, b: string): string {
		let borrow = 0;
		let result = "";
		let i = a.length - 1;
		let j = b.length - 1;

		while (i >= 0) {
			let digitA = Number(a[i]) - borrow;
			const digitB = j >= 0 ? Number(b[j]) : 0;

			if (digitA < digitB) {
				digitA += 10;
				borrow = 1;
			} else {
				borrow = 0;
			}

			result = String(digitA - digitB) + result;
			i--;
			j--;
		}

		return this.trimLeadingZeros(result);
	}

	private static compareIntegerStrings(a: string, b: string): number {
		const normalizedA = this.trimLeadingZeros(a);
		const normalizedB = this.trimLeadingZeros(b);

		if (normalizedA.length !== normalizedB.length) {
			return normalizedA.length > normalizedB.length ? 1 : -1;
		}

		if (normalizedA === normalizedB) return 0;
		return normalizedA > normalizedB ? 1 : -1;
	}

	private static trimLeadingZeros(value: string): string {
		const trimmed = value.replace(/^0+/, "");
		return trimmed === "" ? "0" : trimmed;
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

	private static parseEntity(match: RegExpExecArray, content: string, entity: Map<string, ParsedEntity>){
		if (!match[1]) return;
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
			existing.tags = this.mergeEntityTags(existing.tags, tags);
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

	private static mergeEntityTags(existingTags: string[], incomingTags: string[]): string[] {
		const merged = [...existingTags];

		incomingTags.forEach((tag) => {
			const normalizedTag = tag.replace("→", "->");

			if (normalizedTag.includes("->")) {
				const tagText = normalizedTag.split("->");
				if (tagText[0] !== undefined && tagText[1] !== undefined) {
					const fromTag = tagText[0].trim();
					const toTag = tagText[1].trim();
					const changedIndex = merged.indexOf(fromTag);
					if (changedIndex !== -1) {
						merged[changedIndex] = toTag;
					} else {
						this.upsertEntityTag(merged, toTag);
					}
				}
				return;
			}

			if (normalizedTag.startsWith("+")) {
				const tagToAdd = normalizedTag.slice(1).trim();
				if (tagToAdd) {
					this.upsertEntityTag(merged, tagToAdd);
				}
				return;
			}

			if (normalizedTag.startsWith("-")) {
				const tagToRemove = normalizedTag.slice(1).trim();
				if (!tagToRemove) return;

				const removeIndex = merged.findIndex(
					(existingTag) =>
						existingTag === tagToRemove ||
						this.getEntityTagKey(existingTag) === this.getEntityTagKey(tagToRemove)
				);
				if (removeIndex !== -1) {
					merged.splice(removeIndex, 1);
				}
				return;
			}

			this.upsertEntityTag(merged, normalizedTag);
		});

		return merged;
	}

	private static upsertEntityTag(tags: string[], tag: string): void {
		const normalizedTag = tag.trim();
		if (!normalizedTag) return;

		const tagKey = this.getEntityTagKey(normalizedTag);
		const existingIndex = tags.findIndex(
			(existingTag) => this.getEntityTagKey(existingTag) === tagKey
		);

		if (existingIndex !== -1) {
			tags[existingIndex] = normalizedTag;
			return;
		}

		if (!tags.includes(normalizedTag)) {
			tags.push(normalizedTag);
		}
	}

	private static getEntityTagKey(tag: string): string {
		const trimmedTag = tag.trim();
		const colonIndex = trimmedTag.indexOf(":");
		if (colonIndex !== -1) {
			return trimmedTag.slice(0, colonIndex).trim().toLowerCase();
		}

		const withoutTrailingValue = trimmedTag.replace(
			/\s+[-+]?\d+(?:\.\d+)?(?:\s*\/\s*[-+]?\d+(?:\.\d+)?)?$/,
			""
		).trim();

		return (withoutTrailingValue || trimmedTag).toLowerCase();
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
