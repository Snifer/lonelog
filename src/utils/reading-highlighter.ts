/**
 * Lonelog Syntax Highlighter — Reading Mode
 * Handles reading-mode highlighting for ```lonelog code blocks AND global document notation.
 * Uses shared tokenizer for consistent highlighting across modes.
 */

import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import { tokenizeLines, getTokenClass, Token } from "./lonelog-tokenizer";
import { DiceRoller } from "./dice-roller";
import { CardRoller } from "./card-roller";
import { TableResolver } from "./table-resolver";
import { RollManager } from "./roll-manager";
import { LonelogSettings } from "../settings";

function asString(value: unknown): string {
	return typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

/**
 * Renders a single line of Lonelog notation into a target element.
 * Adds interactive dice buttons if enabled.
 */
function renderLine(
	app: App,
	settings: LonelogSettings,
	rawLine: string,
	tokens: Token[],
	container: HTMLElement,
	ctx: MarkdownPostProcessorContext,
	lineIndexInBlock: number, // 0 if not in a code block
	blockEl: HTMLElement // The element that defines the context for line number mapping
): void {
	const lineEl = container.createEl("div", { cls: "ll-line" });

	// Render each token as a span (or text node if plain text)
	for (const token of tokens) {
		if (token.type === "text") {
			lineEl.appendChild(container.ownerDocument.createTextNode(token.text));
		} else {
			lineEl.createEl("span", {
				cls: getTokenClass(token.type, "ll"),
				text: token.text,
			});
		}
	}

	// Add 🎲 button if it's a rollable line (d:, ?, tbl:, or gen:)
	const trimmedLine = asString(rawLine).trimStart().toLowerCase();
	const isIndented = rawLine.startsWith(" ") || rawLine.startsWith("\t");
	
	if (
		settings.enableDiceRoller &&
		(trimmedLine.startsWith("d:") ||
			trimmedLine.startsWith("?") ||
			trimmedLine.startsWith("tbl:") ||
			trimmedLine.startsWith("gen:") ||
			isIndented)
	) {
		const notation = DiceRoller.extractNotation(rawLine);
		if (notation) {
			const btn = lineEl.createEl("span", {
				cls: "lonelog-dice-widget",
				text: "🎲",
				attr: { title: `Roll ${notation} (inserts result)`, role: "button", tabindex: "0" },
			});

			const doRoll = async (): Promise<void> => {
				const section = ctx.getSectionInfo(blockEl);
				if (!section) return;

				const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
				if (!(file instanceof TFile)) return;

				// absoluteLineNum: section start + offset + current line within the block
				const absoluteLineNum = section.lineStart + lineIndexInBlock;

					const content = asString(await app.vault.read(file));
				const docLines = content.split("\n");
				const rawLineAtRoll = docLines[absoluteLineNum];
				if (rawLineAtRoll === undefined) return;

				const tables = TableResolver.parseTables(content);
					const isGenHeader = asString(rawLineAtRoll).trimStart().toLowerCase().startsWith("gen:");
				
				const lineChanges = new Map<number, string>();

				if (isGenHeader) {
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
					const newLine = RollManager.processLine(rawLineAtRoll, settings, tables);
					if (newLine !== rawLineAtRoll) lineChanges.set(absoluteLineNum, newLine);
				}

				if (lineChanges.size === 0) return;

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
	
	// Add 🎴 button if it's a card notation directly on the line
	if (settings.enableCardAddon) {
		const cardRequests = CardRoller.extractCardRequests(rawLine);
		if (cardRequests.length > 0) {
			const notation = cardRequests.map(c => c.original).join(", ");
			const btn = lineEl.createEl("span", {
				cls: "lonelog-card-widget lonelog-dice-widget",
				text: "🎴",
				attr: { title: `Draw ${notation}`, role: "button", tabindex: "0" },
			});

			const doDraw = async (): Promise<void> => {
				const section = ctx.getSectionInfo(blockEl);
				if (!section) return;

				const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
				if (!(file instanceof TFile)) return;

				const absoluteLineNum = section.lineStart + lineIndexInBlock;

				const content = await app.vault.read(file);
				const docLines = content.split("\n");
				const rawLineAtRoll = docLines[absoluteLineNum];
				if (rawLineAtRoll === undefined) return;

				const newLineText = CardRoller.processLine(rawLineAtRoll, settings.inlineCardDescriptions);
				
				if (newLineText && newLineText !== rawLineAtRoll) {
					await app.vault.process(file, (data) => {
						const lines = data.split("\n");
						if (absoluteLineNum < lines.length) lines[absoluteLineNum] = newLineText;
						return lines.join("\n");
					});
				}
			};

			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				void doDraw();
			});
			btn.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
					void doDraw();
				}
			});
		}
	}
}

/**
 * Markdown code block processor for ```lonelog blocks.
 */
export const lonelogBlockProcessor = (app: App, settings: LonelogSettings) => (
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): void => {
	const pre = el.createEl("pre", { cls: "ll-block" });
	const lines = source.split("\n");

	if (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
		lines.pop();
	}

	const tokenLines = tokenizeLines(lines);

	lines.forEach((rawLine, index) => {
		// In a code block, line 0 is the fence, so first content line is offset 1
		renderLine(app, settings, rawLine, tokenLines[index] || [], pre, ctx, index + 1, el);
	});
};

/**
 * Global Markdown post-processor for standard document elements.
 * Scans paragraphs, list items, etc. for Lonelog notation.
 */
export const lonelogGlobalProcessor = (app: App, settings: LonelogSettings) => (
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
): void => {
	// Skip if inside a code block (already handled by specialized processor or ignored)
	if (el.tagName === "PRE" || el.closest("pre")) return;

	// Target elements that typically contain single-line notation
	const targets = el.querySelectorAll("p, li, blockquote");
	if (targets.length === 0 && (el.tagName === "P" || el.tagName === "LI" || el.tagName === "BLOCKQUOTE")) {
		// el itself might be a target depending on how Obsidian calls the processor
		processTarget(el, app, settings, ctx);
	} else {
		targets.forEach(target => processTarget(target as HTMLElement, app, settings, ctx));
	}
};

function processTarget(
	target: HTMLElement,
	app: App,
	settings: LonelogSettings,
	ctx: MarkdownPostProcessorContext
): void {
	// Only process if the text content starts with a Lonelog symbol or contains inline tags
	const text = typeof target.innerText === "string" ? target.innerText : target.textContent ?? "";
	const trimmed = text.trimStart();
	
	// Fast check: does it look like Lonelog?
	const isLonelog = /^[?@d:]|=>|->|\[\w+:/.test(trimmed);
	if (!isLonelog) return;

	// We'll replace the content with rendered Lonelog lines
	// Warning: This might break other Obsidian plugins that rely on the original DOM structure
	// but for plain text notation it is generally safe.
	const rawLines = text.split("\n");
	const tokenLines = tokenizeLines(rawLines);
	target.empty();
	target.addClass("ll-global-container");
	
	rawLines.forEach((line, idx) => {
		// For global elements, we don't have a simple "index in block".
		// We'll pass 0 and rely on sectionInfo for the start.
		// Note: SectionInfo for a paragraph returns the line index of the paragraph.
		renderLine(app, settings, line, tokenLines[idx] || [], target, ctx, 0, target);
	});
}
