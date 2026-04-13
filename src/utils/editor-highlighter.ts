/**
 * Lonelog Live Editor Highlighting (CodeMirror 6)
 * Highlights Lonelog notation inside ```lonelog code blocks.
 * Uses shared tokenizer for consistent highlighting across modes.
 */

import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { Range, RangeSetBuilder } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { tokenizeLine, getTokenClass } from "./lonelog-tokenizer";
import { DiceRoller } from "./dice-roller";
import { TableResolver } from "./table-resolver";
import { RollManager } from "./roll-manager";
import { LonelogSettings } from "../settings";

// ---------------------------------------------------------------------------
// Find lonelog blocks by scanning for fence markers
// ---------------------------------------------------------------------------

function findLonelogBlocks(state: EditorState): Array<{ from: number, to: number }> {
	const blocks: Array<{ from: number, to: number }> = [];
	const doc = state.doc;
	let inLonelogBlock = false;
	let blockStart = 0;

	// Note: For performance in very large documents, we could use a state field,
	// but for typical notes, scanning line prefixes is fast.
	for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
		const line = doc.line(lineNum);
		const text = line.text.trimStart();

		if (!inLonelogBlock && text.startsWith("```lonelog")) {
			inLonelogBlock = true;
			blockStart = line.to + 1;
		} else if (inLonelogBlock && text.startsWith("```")) {
			blocks.push({ from: blockStart, to: line.from - 1 });
			inLonelogBlock = false;
		}
	}

	if (inLonelogBlock) {
		blocks.push({ from: blockStart, to: doc.length });
	}

	return blocks;
}

// ---------------------------------------------------------------------------
// Dice Widget
// ---------------------------------------------------------------------------

class DiceWidget extends WidgetType {
	constructor(
		private readonly notation: string,
		private readonly settings: LonelogSettings
	) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		span.innerText = "🎲";
		span.className = "lonelog-dice-widget";
		span.title = `Roll ${this.notation} (inserts result)`;
		span.setAttribute("role", "button");
		span.style.cursor = "pointer";
		span.style.marginLeft = "4px";

		// Use pointerdown/mousedown so it triggers before CodeMirror drops the node
		span.onmousedown = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.roll(view, span);
		};
		// Also support touch
		span.ontouchstart = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.roll(view, span);
		};

		return span;
	}

	private roll(view: EditorView, element: HTMLElement): void {
		// Find the actual line using the element's current DOM position
		const pos = view.posAtDOM(element);
		if (pos === null) return;
		const line = view.state.doc.lineAt(pos);
		const lineText = line.text;
		
		// 1. Detection: Are we on a gen: header?
		const isGenHeader = lineText.trimStart().toLowerCase().startsWith("gen:");
		const fullContent = view.state.doc.toString();
		const tables = TableResolver.parseTables(fullContent);

		if (isGenHeader) {
			// Roll all indented lines below
			let currentIdx = line.number + 1;
			while (currentIdx <= view.state.doc.lines) {
				const nextLine = view.state.doc.line(currentIdx);
				const nextLineText = nextLine.text;
				
				if (nextLineText.startsWith(" ") || nextLineText.startsWith("\t")) {
					const newLineText = RollManager.processLine(nextLineText, this.settings, tables);
					if (newLineText !== nextLineText) {
						view.dispatch({
							changes: { from: nextLine.from, to: nextLine.to, insert: newLineText }
						});
					}
				} else if (nextLineText.trim() === "") {
					// Skip empty
				} else {
					break;
				}
				currentIdx++;
			}
			return;
		}

		// 2. Otherwise process just the current line
		const newLineText = RollManager.processLine(lineText, this.settings, tables);
		if (newLineText !== lineText) {
			view.dispatch({
				changes: { from: line.from, to: line.to, insert: newLineText }
			});
		}
	}

	ignoreEvent(event: Event): boolean {
		return event.type === "mousedown" || event.type === "click" || event.type === "touchstart";
	}
}

// ---------------------------------------------------------------------------
// Decoration builder
// ---------------------------------------------------------------------------

function buildDecorations(view: EditorView, settings: LonelogSettings): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const decorations: Array<Range<Decoration>> = [];

	// Obtain all blocks in the document
	const allBlocks = findLonelogBlocks(view.state);

	for (const { from, to } of view.visibleRanges) {
		// Filter blocks that overlap with the visible range
		const visibleBlocks = allBlocks.filter(b => b.to >= from && b.from <= to);

		for (const block of visibleBlocks) {
			const doc = view.state.doc;
			const startLine = doc.lineAt(Math.max(block.from, from)).number;
			const endLine = doc.lineAt(Math.min(block.to, to)).number;

			for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
				const line = doc.line(lineNum);
				if (line.from < block.from || line.to > block.to) continue;

				const lineText = line.text;

				// Add line decoration for text wrapping
				decorations.push({
					from: line.from,
					to: line.from,
					value: Decoration.line({ class: "ll-ed-line" }),
				});

				// Tokenize using shared logic
				const tokens = tokenizeLine(lineText);

				// Convert tokens to CM6 decorations
				for (const token of tokens) {
					if (token.type === "text") continue; // Skip plain text

					const cssClass = getTokenClass(token.type, "ll-ed");
					if (!cssClass) continue;

					decorations.push({
						from: line.from + token.start,
						to: line.from + token.end,
						value: Decoration.mark({ class: cssClass }),
					});
				}

				// Check for rollable line (d:, ?, tbl:, or gen:)
				const trimmedLine = lineText.trimStart().toLowerCase();
				if (
					settings.enableDiceRoller &&
					(trimmedLine.startsWith("d:") ||
						trimmedLine.startsWith("?") ||
						trimmedLine.startsWith("tbl:") ||
						trimmedLine.startsWith("gen:") ||
						lineText.startsWith(" ") || 
						lineText.startsWith("\t"))
				) {
					const notation = DiceRoller.extractNotation(lineText);
					if (notation) {
						decorations.push({
							from: line.to,
							to: line.to,
							value: Decoration.widget({
								widget: new DiceWidget(notation, settings),
								side: 1,
							}),
						});
					}
				}
			}
		}
	}

	decorations.sort((a, b) => a.from - b.from || a.to - b.to);
	for (const deco of decorations) {
		builder.add(deco.from, deco.to, deco.value);
	}

	return builder.finish();
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

export const lonelogEditorPlugin = (settings: LonelogSettings) => ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view, settings);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = buildDecorations(update.view, settings);
			}
		}
	},
	{
		decorations: (v) => v.decorations,
	}
);
