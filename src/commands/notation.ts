import { App, Editor } from "obsidian";
import { LonelogSettings } from "../settings";
import { TrackModal } from "./templates";
import { TableResolver, TableDefinition } from "../utils/table-resolver";
import { RollManager } from "../utils/roll-manager";
import { CardRoller } from "../utils/card-roller";

export class NotationCommands {
	// Single symbol insertions
	static insertAction(editor: Editor, settings: LonelogSettings): void {
		const text = settings.insertSpaceAfterSymbol ? "@ " : "@";
		editor.replaceSelection(text);
	}

	static insertQuestion(editor: Editor, settings: LonelogSettings): void {
		const text = settings.insertSpaceAfterSymbol ? "? " : "?";
		editor.replaceSelection(text);
	}

	static insertDiceRoll(editor: Editor, settings: LonelogSettings): void {
		const text = settings.insertSpaceAfterSymbol ? "d: " : "d:";
		editor.replaceSelection(text);
	}

	static insertResult(editor: Editor, settings: LonelogSettings): void {
		const text = settings.insertSpaceAfterSymbol ? "-> " : "->";
		editor.replaceSelection(text);
	}

	static insertConsequence(editor: Editor, settings: LonelogSettings): void {
		const text = settings.insertSpaceAfterSymbol ? "=> " : "=>";
		editor.replaceSelection(text);
	}

	// Multi-line pattern insertions
	static insertActionSequence(editor: Editor, settings: LonelogSettings): void {
		const template = settings.actionSequenceTemplate;
		const cursor = editor.getCursor();

		editor.replaceSelection(template);

		if (settings.smartCursorPositioning) {
			// Move cursor to after "@ " on first line
			editor.setCursor({
				line: cursor.line,
				ch: cursor.ch + 2,
			});
		}
	}

	static insertOracleSequence(editor: Editor, settings: LonelogSettings): void {
		const template = settings.oracleSequenceTemplate;
		const cursor = editor.getCursor();

		editor.replaceSelection(template);

		if (settings.smartCursorPositioning) {
			// Move cursor to after "? " on first line
			editor.setCursor({
				line: cursor.line,
				ch: cursor.ch + 2,
			});
		}
	}

	// Tag snippet insertions
	static insertNPCTag(editor: Editor, settings: LonelogSettings): void {
		const text = "[N:Name|]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			// Select "Name" for easy replacement
			editor.setSelection(
				{ line: cursor.line, ch: cursor.ch + 3 },
				{ line: cursor.line, ch: cursor.ch + 7 }
			);
		}
	}

	static insertLocationTag(editor: Editor, settings: LonelogSettings): void {
		const text = "[L:Name|]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			// Select "Name" for easy replacement
			editor.setSelection(
				{ line: cursor.line, ch: cursor.ch + 3 },
				{ line: cursor.line, ch: cursor.ch + 7 }
			);
		}
	}

	static insertEventClock(app: App, editor: Editor, settings: LonelogSettings): void {
		// Scan the live editor content for the last [E:Name y/X] tag
		const content = editor.getValue();
		const eventRegex = /\[E:([^\]]+?)\s+(\d+)\/(\d+)\]/g;
		let lastMatch: RegExpMatchArray | null = null;
		let match: RegExpMatchArray | null;

		while ((match = eventRegex.exec(content)) !== null) {
			lastMatch = match;
		}

		if (lastMatch && lastMatch[1] && lastMatch[2] && lastMatch[3]) {
			const eventName = lastMatch[1];
			const currentValue = parseInt(lastMatch[2]);
			const maxValue = parseInt(lastMatch[3]);

			if (currentValue < maxValue) {
				// Still in progress — increment silently
				editor.replaceSelection(`[E:${eventName} ${currentValue + 1}/${maxValue}]`);
				return;
			}
			// Clock is complete — fall through to insert fresh template below
		}
		{
			// No existing event — insert template and select "Name" for easy replacement
			const text = "[E:Name 0/6]";
			const cursor = editor.getCursor();
			editor.replaceSelection(text);
			if (settings.smartCursorPositioning) {
				editor.setSelection(
					{ line: cursor.line, ch: cursor.ch + 3 },
					{ line: cursor.line, ch: cursor.ch + 7 }
				);
			}
		}
	}

	static insertTrack(app: App, editor: Editor, settings: LonelogSettings): void {
		const activeFile = app.workspace.getActiveFile();
		if (!activeFile) {
			// Fallback to simple insertion if no active file
			const text = "[Track:Name 0/6]";
			const cursor = editor.getCursor();
			editor.replaceSelection(text);
			if (settings.smartCursorPositioning) {
				editor.setSelection(
					{ line: cursor.line, ch: cursor.ch + 7 },
					{ line: cursor.line, ch: cursor.ch + 11 }
				);
			}
			return;
		}

		// Show modal to get track name
		const modal = new TrackModal(app, (trackName: string, maxValue: number) => {
			if (!trackName.trim()) {
				// If no name provided, insert template
				const text = `[Track:Name 0/${maxValue}]`;
				const cursor = editor.getCursor();
				editor.replaceSelection(text);
				if (settings.smartCursorPositioning) {
					editor.setSelection(
						{ line: cursor.line, ch: cursor.ch + 7 },
						{ line: cursor.line, ch: cursor.ch + 11 }
					);
				}
				return;
			}

			// Read file content and look for existing track
			void app.vault.read(activeFile).then((content) => {
				const trackRegex = new RegExp(`\\[Track:${trackName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)/(\\d+)\\]`, 'g');
				let lastMatch: RegExpMatchArray | null = null;
				let match: RegExpMatchArray | null;

				// Find the last occurrence of this track
				while ((match = trackRegex.exec(content)) !== null) {
					lastMatch = match;
				}

				let text: string;
				if (lastMatch && lastMatch[1] && lastMatch[2]) {
					// Track exists - increment the counter
					const currentValue = parseInt(lastMatch[1]);
					const maxFromDoc = parseInt(lastMatch[2]);
					const newValue = Math.min(currentValue + 1, maxFromDoc);
					text = `[Track:${trackName} ${newValue}/${maxFromDoc}]`;
				} else {
					// New track - start at 0
					text = `[Track:${trackName} 0/${maxValue}]`;
				}

				editor.replaceSelection(text);
			});
		});
		modal.open();
	}

	static insertThread(editor: Editor, settings: LonelogSettings): void {
		const text = "[Thread:Name|Open]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			// Select "Name" for easy replacement
			editor.setSelection(
				{ line: cursor.line, ch: cursor.ch + 8 },
				{ line: cursor.line, ch: cursor.ch + 12 }
			);
		}
	}

	static insertPCTag(editor: Editor, settings: LonelogSettings): void {
		const text = "[PC:Name|]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			// Select "Name" for easy replacement
			editor.setSelection(
				{ line: cursor.line, ch: cursor.ch + 4 },
				{ line: cursor.line, ch: cursor.ch + 8 }
			);
		}
	}

	static insertTimer(editor: Editor, settings: LonelogSettings): void {
		const text = "[Timer:Name 0]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			// Select "Name" for easy replacement
			editor.setSelection(
				{ line: cursor.line, ch: cursor.ch + 7 },
				{ line: cursor.line, ch: cursor.ch + 11 }
			);
		}
	}

	static insertReference(editor: Editor, settings: LonelogSettings): void {
		const text = "[#N:Name]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			// Select "Name" for easy replacement
			editor.setSelection(
				{ line: cursor.line, ch: cursor.ch + 4 },
				{ line: cursor.line, ch: cursor.ch + 8 }
			);
		}
	}
	static rollDiceOnLine(editor: Editor, settings: LonelogSettings): void {
		const cursor = editor.getCursor();
		const lineNum = cursor.line;
		const lineText = editor.getLine(lineNum);

		const fullContent = editor.getValue();
		const tables = TableResolver.parseTables(fullContent);

		// 1. Detection: Are we on a gen: header?
		const isGenHeader = lineText.trimStart().toLowerCase().startsWith("gen:");

		if (isGenHeader) {
			// Roll all indented lines below
			let currentIdx = lineNum + 1;
			while (currentIdx < editor.lineCount()) {
				const nextLineText = editor.getLine(currentIdx);
				// If indented, it's a generator sub-line
				if (nextLineText.startsWith(" ") || nextLineText.startsWith("\t")) {
					const newLineText = RollManager.processLine(nextLineText, settings, tables);
					if (newLineText !== nextLineText) {
						editor.setLine(currentIdx, newLineText);
					}
				} else if (nextLineText.trim() === "") {
					// Skip empty lines but keep looking
				} else {
					// Reached end of block
					break;
				}
				currentIdx++;
			}
			return;
		}

		// 2. Otherwise process just the current line
		const newLineText = RollManager.processLine(lineText, settings, tables);
		if (newLineText !== lineText) {
			editor.setLine(lineNum, newLineText);
		}
	}

	static drawCardOnLine(editor: Editor, settings: LonelogSettings): void {
		if (!settings.enableCardAddon) return;
		
		const cursor = editor.getCursor();
		const lineNum = cursor.line;
		const lineText = editor.getLine(lineNum);

		const newLineText = CardRoller.processLine(lineText, settings.inlineCardDescriptions);
		if (newLineText && newLineText !== lineText) {
			editor.setLine(lineNum, newLineText);
		}
	}

	static insertCombatBlock(editor: Editor, settings: LonelogSettings): void {
		const text = "[COMBAT]\n\n[/COMBAT]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			editor.setCursor({ line: cursor.line + 1, ch: 0 });
		}
	}

	static insertRoundMarker(editor: Editor, settings: LonelogSettings): void {
		const text = "Rd1 ";
		editor.replaceSelection(text);
	}

	static insertFoeTag(editor: Editor, settings: LonelogSettings): void {
		const text = "[F:Name|]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			editor.setSelection(
				{ line: cursor.line, ch: cursor.ch + 3 },
				{ line: cursor.line, ch: cursor.ch + 7 }
			);
		}
	}

	static insertRoomTag(editor: Editor, settings: LonelogSettings): void {
		const text = "[R:1|active|]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			editor.setSelection(
				{ line: cursor.line, ch: cursor.ch + 3 },
				{ line: cursor.line, ch: cursor.ch + 4 }
			);
		}
	}

	static insertDungeonStatus(editor: Editor, settings: LonelogSettings): void {
		const text = "[DUNGEON STATUS]\n\n[/DUNGEON STATUS]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			editor.setCursor({ line: cursor.line + 1, ch: 0 });
		}
	}

	static insertInventoryTag(editor: Editor, settings: LonelogSettings): void {
		const text = "[Inv:Name|1|]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			editor.setCursor({ line: cursor.line, ch: cursor.ch + 5 });
		}
	}

	static insertWealthTag(editor: Editor, settings: LonelogSettings): void {
		const text = "[Wealth:Gold 0]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);

		if (settings.smartCursorPositioning) {
			editor.setCursor({ line: cursor.line, ch: cursor.ch + 8 });
		}
	}

	static insertResourcesBlock(editor: Editor, settings: LonelogSettings): void {
		const text = "[RESOURCES]\n\n[/RESOURCES]";
		const cursor = editor.getCursor();
		editor.replaceSelection(text);
		editor.setCursor({ line: cursor.line + 1, ch: 0 });
	}

	/**
	 * @deprecated Use RollManager.processLine instead. Only kept for backward compatibility if needed within this class.
	 */
	private static processSingleLine(
		editor: Editor, 
		lineNum: number, 
		settings: LonelogSettings,
		tables: Map<string, TableDefinition>
	): void {
		const lineText = editor.getLine(lineNum);
		const newLineText = RollManager.processLine(lineText, settings, tables);
		if (newLineText !== lineText) {
			editor.setLine(lineNum, newLineText);
		}
	}
}
