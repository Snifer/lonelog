/**
 * Lonelog Auto-completion
 * Provides intelligent suggestions for Lonelog notation tags
 */

import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import { NotationParser, ParsedElements } from "./parser";

interface TagSuggestion {
	name: string;
	type: "npc" | "location" | "thread" | "pc" | "clock" | "track" | "timer" | "room" | "inventory" | "wealth" | "foe";
	tags?: string[];
	current?: number;
	max?: number;
	displayText: string;
}

export class LonelogAutoComplete extends EditorSuggest<TagSuggestion> {
	private parsedElements: ParsedElements | null = null;
	private lastContent: string = "";

	constructor(app: App) {
		super(app);
	}

	/**
	 * Trigger auto-completion on specific patterns
	 */
	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null
	): EditorSuggestTriggerInfo | null {
		if (!file) return null;

		const line = editor.getLine(cursor.line);
		const beforeCursor = line.substring(0, cursor.ch);

		// Single regex for all tags supporting optional '#' prefix
		const tagMatch = beforeCursor.match(/\[(#)?(N|L|Thread|PC|E|Clock|Track|Timer|R|Inv|Wealth|F):([^\]|]*)$/i);
		if (tagMatch) {
			const query = tagMatch[3] || "";
			const start = cursor.ch - query.length;

			return {
				start: { line: cursor.line, ch: start },
				end: cursor,
				query,
			};
		}

		return null;
	}


	/**
	 * Get suggestions based on current context
	 */
	getSuggestions(
		context: EditorSuggestContext
	): TagSuggestion[] | Promise<TagSuggestion[]> {
		// Parse document if needed
		const content = context.editor.getValue();
		if (content !== this.lastContent) {
			this.parsedElements = NotationParser.parse(content);
			this.lastContent = content;
		}

		if (!this.parsedElements) {
			return [];
		}

		const line = context.editor.getLine(context.start.line);
		const beforeCursor = line.substring(0, context.end.ch);
		const query = context.query.toLowerCase();

		// Determine which type of tag we're completing using regex to ensure we're at the current tag
		if (/\[(#)?N:[^\]|]*$/i.test(beforeCursor)) {
			return this.getNPCSuggestions(query);
		} else if (/\[(#)?L:[^\]|]*$/i.test(beforeCursor)) {
			return this.getLocationSuggestions(query);
		} else if (/\[(#)?Thread:[^\]|]*$/i.test(beforeCursor)) {
			return this.getThreadSuggestions(query);
		} else if (/\[(#)?PC:[^\]|]*$/i.test(beforeCursor)) {
			return this.getPCSuggestions(query);
		} else if (/\[(#)?(E|Clock):[^\]|]*$/i.test(beforeCursor)) {
			return this.getProgressSuggestions(query, "clock");
		} else if (/\[(#)?Track:[^\]|]*$/i.test(beforeCursor)) {
			return this.getProgressSuggestions(query, "track");
		} else if (/\[(#)?Timer:[^\]|]*$/i.test(beforeCursor)) {
			return this.getProgressSuggestions(query, "timer");
		} else if (/\[(#)?R:[^\]|]*$/i.test(beforeCursor)) {
			return this.getRoomSuggestions(query);
		} else if (/\[(#)?Inv:[^\]|]*$/i.test(beforeCursor)) {
			return this.getInventorySuggestions(query);
		} else if (/\[(#)?Wealth:[^\]|]*$/i.test(beforeCursor)) {
			return this.getWealthSuggestions(query);
		} else if (/\[(#)?F:[^\]|]*$/i.test(beforeCursor)) {
			return this.getFoeSuggestions(query);
		}

		return [];
	}


	/**
	 * Get NPC suggestions
	 */
	private getNPCSuggestions(query: string): TagSuggestion[] {
		if (!this.parsedElements) return [];

		const suggestions: TagSuggestion[] = [];

		for (const [name, npc] of this.parsedElements.npcs.entries()) {
			if (query === "" || name.toLowerCase().includes(query)) {
				const tagsDisplay =
					npc.tags.length > 0 ? ` (${npc.tags.join(", ")})` : "";
				suggestions.push({
					name,
					type: "npc",
					tags: npc.tags,
					displayText: `${name}${tagsDisplay}`,
				});
			}
		}

		// Sort by relevance
		return this.sortSuggestions(suggestions, query);
	}

	/**
	 * Get location suggestions
	 */
	private getLocationSuggestions(query: string): TagSuggestion[] {
		if (!this.parsedElements) return [];

		const suggestions: TagSuggestion[] = [];

		for (const [name, location] of this.parsedElements.locations.entries()) {
			if (query === "" || name.toLowerCase().includes(query)) {
				const tagsDisplay =
					location.tags.length > 0
						? ` (${location.tags.join(", ")})`
						: "";
				suggestions.push({
					name,
					type: "location",
					tags: location.tags,
					displayText: `${name}${tagsDisplay}`,
				});
			}
		}

		return this.sortSuggestions(suggestions, query);
	}

	/**
	 * Get thread suggestions
	 */
	private getThreadSuggestions(query: string): TagSuggestion[] {
		if (!this.parsedElements) return [];

		const suggestions: TagSuggestion[] = [];

		for (const [name, thread] of this.parsedElements.threads.entries()) {
			if (query === "" || name.toLowerCase().includes(query)) {
				suggestions.push({
					name,
					type: "thread",
					displayText: `${name} [${thread.state}]`,
				});
			}
		}

		return this.sortSuggestions(suggestions, query);
	}

	/**
	 * Get PC suggestions
	 */
	private getPCSuggestions(query: string): TagSuggestion[] {
		if (!this.parsedElements) return [];

		const suggestions: TagSuggestion[] = [];

		for (const [name, pc] of this.parsedElements.pcs.entries()) {
			if (query === "" || name.toLowerCase().includes(query)) {
				const tagsDisplay =
					pc.tags.length > 0 ? ` (${pc.tags.join(", ")})` : "";
				suggestions.push({
					name,
					type: "pc",
					tags: pc.tags,
					displayText: `${name}${tagsDisplay}`,
				});
			}
		}

		return this.sortSuggestions(suggestions, query);
	}

	/**
	 * Get progress suggestions (clocks, tracks, timers)
	 */
	private getProgressSuggestions(
		query: string,
		type: "clock" | "track" | "timer"
	): TagSuggestion[] {
		if (!this.parsedElements) return [];

		const suggestions: TagSuggestion[] = [];

		for (const item of this.parsedElements.progress) {
			if (item.type !== type) continue;

			if (query === "" || item.name.toLowerCase().includes(query)) {
				let displayText = item.name;
				if (item.max !== undefined) {
					displayText += ` [${item.current}/${item.max}]`;
				} else {
					displayText += ` [${item.current}]`;
				}

				suggestions.push({
					name: item.name,
					type: item.type,
					current: item.current,
					max: item.max,
					displayText,
				});
			}
		}

		return this.sortSuggestions(suggestions, query);
	}

	/**
	 * Get Room suggestions
	 */
	private getRoomSuggestions(query: string): TagSuggestion[] {
		if (!this.parsedElements) return [];

		const suggestions: TagSuggestion[] = [];

		for (const [id, room] of this.parsedElements.rooms.entries()) {
			if (query === "" || id.toLowerCase().includes(query)) {
				let displayText = `R${id}`;
				if (room.description) displayText += ` (${room.description})`;
				if (room.status.length > 0) displayText += ` [${room.status.join(", ")}]`;

				suggestions.push({
					name: id,
					type: "room",
					displayText,
				});
			}
		}

		return this.sortSuggestions(suggestions, query);
	}

	/**
	 * Get Inventory suggestions
	 */
	private getInventorySuggestions(query: string): TagSuggestion[] {
		if (!this.parsedElements) return [];

		const suggestions: TagSuggestion[] = [];

		for (const [name, item] of this.parsedElements.inventory.entries()) {
			if (query === "" || name.toLowerCase().includes(query)) {
				let displayText = name;
				if (item.quantity && item.quantity !== "1" && item.quantity !== "") {
					displayText += ` (x${item.quantity})`;
				}
				
				if (item.properties && item.properties.length > 0) {
					displayText += ` [${item.properties.join(", ")}]`;
				}

				suggestions.push({
					name,
					type: "inventory",
					displayText,
				});
			}
		}

		return this.sortSuggestions(suggestions, query);
	}

	/**
	 * Get Wealth suggestions
	 */
	private getWealthSuggestions(query: string): TagSuggestion[] {
		if (!this.parsedElements) return [];

		const suggestions: TagSuggestion[] = [];

		for (const [name, qty] of this.parsedElements.wealth.entries()) {
			if (query === "" || name.toLowerCase().includes(query)) {
				let displayText = `${name} (${qty})`;

				suggestions.push({
					name,
					type: "wealth",
					displayText,
				});
			}
		}

		return this.sortSuggestions(suggestions, query);
	}

	/**
	 * Get Foe suggestions
	 */
	private getFoeSuggestions(query: string): TagSuggestion[] {
		if (!this.parsedElements) return [];

		const suggestions: TagSuggestion[] = [];
		const seenFoes = new Set<string>();

		for (const encounter of this.parsedElements.combat) {
			for (const [name, combatant] of encounter.combatants.entries()) {
				if (combatant.type === "foe" && !seenFoes.has(name)) {
					seenFoes.add(name);
					if (query === "" || name.toLowerCase().includes(query)) {
						suggestions.push({
							name,
							type: "foe",
							tags: combatant.stats,
							displayText: `${name}${combatant.stats.length > 0 ? ` (${combatant.stats.join(", ")})` : ""}`,
						});
					}
				}
			}
		}

		return this.sortSuggestions(suggestions, query);
	}

	/**
	 * Sort suggestions by relevance
	 */
	private sortSuggestions(
		suggestions: TagSuggestion[],
		query: string
	): TagSuggestion[] {
		const lowerQuery = query.toLowerCase();

		return suggestions.sort((a, b) => {
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();

			// Exact match first
			if (aName === lowerQuery && bName !== lowerQuery) return -1;
			if (aName !== lowerQuery && bName === lowerQuery) return 1;

			// Starts with query
			const aStarts = aName.startsWith(lowerQuery);
			const bStarts = bName.startsWith(lowerQuery);
			if (aStarts && !bStarts) return -1;
			if (!aStarts && bStarts) return 1;

			// Alphabetical
			return a.name.localeCompare(b.name);
		});
	}

	/**
	 * Render suggestion in popup
	 */
	renderSuggestion(suggestion: TagSuggestion, el: HTMLElement): void {
		const container = el.createDiv({ cls: "lonelog-suggestion" });

		// Name and type
		const nameEl = container.createDiv({ cls: "lonelog-suggestion-name" });
		nameEl.setText(suggestion.name);

		// Tags/state info or progress info
		if (suggestion.tags && suggestion.tags.length > 0) {
			const tagsEl = container.createDiv({
				cls: "lonelog-suggestion-tags",
			});
			tagsEl.setText(suggestion.tags.join(" | "));
		} else if (suggestion.current !== undefined) {
			const progressEl = container.createDiv({
				cls: "lonelog-suggestion-tags",
			});
			if (suggestion.max !== undefined) {
				progressEl.setText(`${suggestion.current} / ${suggestion.max}`);
			} else {
				progressEl.setText(`${suggestion.current}`);
			}
		}

		// Type indicator
		const typeEl = container.createDiv({ cls: "lonelog-suggestion-type" });
		typeEl.setText(suggestion.type.toUpperCase());
	}


	/**
	 * Handle suggestion selection
	 */
	selectSuggestion(
		suggestion: TagSuggestion,
		evt: MouseEvent | KeyboardEvent
	): void {
		if (!this.context) return;

		const editor = this.context.editor;
		const line = editor.getLine(this.context.start.line);
		const beforeCursor = line.substring(0, this.context.end.ch);

		// Determine what to insert based on tag type
		let insertion = "";

		// Check if we're completing a reference [#N:
		const isReference = /\[#\w+:/.test(beforeCursor);

		if (isReference) {
			// Just close the reference tag
			insertion = `${suggestion.name}]`;
		} else {
			// Complete the tag with placeholder for additional info
			switch (suggestion.type) {
				case "npc":
				case "location":
				case "pc":
				case "foe":
					// Include existing tags if any
					if (suggestion.tags && suggestion.tags.length > 0) {
						insertion = `${suggestion.name}|${suggestion.tags.join("|")}`;
					} else {
						insertion = `${suggestion.name}`;
					}
					break;
				case "thread":
					insertion = `${suggestion.name}|Open]`;
					break;
				case "clock": {
					// Detect prefix (E: or Clock:)
					insertion = `${suggestion.name} ${suggestion.current}/${suggestion.max}`;
					break;
				}
				case "track":
					insertion = `${suggestion.name} ${suggestion.current}/${suggestion.max}`;
					break;
				case "timer":
					insertion = `${suggestion.name} ${suggestion.current}`;
					break;
				case "room":
					insertion = `${suggestion.name}|active`;
					break;
				case "inventory":
				case "wealth":
					insertion = `${suggestion.name}`;
					break;
			}
		}


		// Replace the query with the insertion
		editor.replaceRange(
			insertion,
			this.context.start,
			this.context.end
		);

		// Position cursor before the closing bracket for easy editing
		if (!isReference) {
			const newPos = {
				line: this.context.start.line,
				ch: this.context.start.ch + insertion.length - 1,
			};
			editor.setCursor(newPos);
		}
	}
}
