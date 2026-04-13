/**
 * Lonelog Syntax Highlighter — Reading Mode
 * Handles reading-mode highlighting for ```lonelog code blocks.
 * Uses shared tokenizer for consistent highlighting across modes.
 * Adds a 🎲 dice button on `d:` lines to roll and insert the result into the document.
 */

import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import { tokenizeLine, getTokenClass } from "./lonelog-tokenizer";
import { DiceRoller } from "./dice-roller";
import { TableResolver } from "./table-resolver";
import { RollManager } from "./roll-manager";
import { LonelogSettings } from "../settings";

/**
 * Main code block processor. Register with:
 *   this.registerMarkdownCodeBlockProcessor("lonelog", lonelogBlockProcessor(this.app, this.settings));
 */
export const lonelogBlockProcessor = (app: App, settings: LonelogSettings) => (
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): void => {
	const pre = el.createEl("pre", { cls: "ll-block" });
	const lines = source.split("\n");

	// Remove trailing empty line that editors often append
	if (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
		lines.pop();
	}

	let lineIndex = 0;
	for (const rawLine of lines) {
		const currentLineIndex = lineIndex++;
		const lineEl = pre.createEl("div", { cls: "ll-line" });

		// Tokenize the line using shared logic
		const tokens = tokenizeLine(rawLine);

		// Render each token as a span (or text node if plain text)
		for (const token of tokens) {
			if (token.type === "text") {
				lineEl.appendChild(document.createTextNode(token.text));
			} else {
				lineEl.createEl("span", {
					cls: getTokenClass(token.type, "ll"),
					text: token.text,
				});
			}
		}

		// Add 🎲 button if it's a rollable line (d:, ?, tbl:, or gen:)
		const trimmedLine = rawLine.trimStart().toLowerCase();
		if (
			settings.enableDiceRoller &&
		(trimmedLine.startsWith("d:") ||
				trimmedLine.startsWith("?") ||
				trimmedLine.startsWith("tbl:") ||
				trimmedLine.startsWith("gen:") ||
				rawLine.startsWith(" ") || 
				rawLine.startsWith("\t"))
		) {
			const notation = DiceRoller.extractNotation(rawLine);
			if (notation) {
				const btn = lineEl.createEl("span", {
					cls: "lonelog-dice-widget",
					text: "🎲",
					attr: { title: `Roll ${notation} (inserts result)`, role: "button", tabindex: "0" },
				});

				const doRoll = async (): Promise<void> => {
					// Identify the line in the document
					const section = ctx.getSectionInfo(el);
					if (!section) return;

					const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
					if (!(file instanceof TFile)) return;

					const absoluteLineNum = section.lineStart + 1 + currentLineIndex;

					// Read file to parse tables and detect blocks
					const content = await app.vault.read(file);
					const docLines = content.split("\n");
					const rawLineAtRoll = docLines[absoluteLineNum];
					if (rawLineAtRoll === undefined) return;

					const tables = TableResolver.parseTables(content);
					const isGenHeader = rawLineAtRoll.trimStart().toLowerCase().startsWith("gen:");
					
					// We'll collect all changes (line index -> new text)
					const lineChanges = new Map<number, string>();

					if (isGenHeader) {
						// Process header and all indented children
						let currentIdx = absoluteLineNum + 1;
						while (currentIdx < docLines.length) {
							const nextLineText = docLines[currentIdx];
							if (nextLineText === undefined) {
								currentIdx++;
								continue;
							}
							
							if (nextLineText.startsWith(" ") || nextLineText.startsWith("\t")) {
								const newLine = RollManager.processLine(nextLineText, settings, tables);
								if (newLine !== nextLineText) lineChanges.set(currentIdx, newLine);
							} else if (nextLineText.trim() === "") {
								// skip
							} else {
								break;
							}
							currentIdx++;
						}
					} else {
						// Just process this one line
						const newLine = RollManager.processLine(rawLineAtRoll, settings, tables);
						if (newLine !== rawLineAtRoll) lineChanges.set(absoluteLineNum, newLine);
					}

					// If no changes, stop here
					if (lineChanges.size === 0) return;

					// Apply all changes in a single atomic process call
					await app.vault.process(file, (data) => {
						const lines = data.split("\n");
						lineChanges.forEach((newText, idx) => {
							if (idx < lines.length) lines[idx] = newText;
						});
						return lines.join("\n");
					});
				};

				btn.addEventListener("click", (e) => {
					e.stopPropagation();
					void doRoll();
				});
				btn.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						e.stopPropagation();
						void doRoll();
					}
				});
			}
		}
	}
};
