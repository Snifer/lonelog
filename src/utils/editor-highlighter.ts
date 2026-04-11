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
		private readonly lineNum: number,
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

		span.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.roll(view);
		};

		return span;
	}

	private roll(view: EditorView): void {
		const line = view.state.doc.line(this.lineNum);
		const lineText = line.text;
		
		let notationToRoll = this.notation;
		let tableOutcome: string | undefined;

		// If this is a table roll, try to resolve it
		if (lineText.trimStart().toLowerCase().startsWith("tbl:")) {
			const fullContent = view.state.doc.toString();
			const tables = TableResolver.parseTables(fullContent);
			
			// Robust pattern: tbl: Name Dice (handles cases where Name contains 'd')
			const tblMatch = /tbl:\s*(.+?)\s*(\d*d(?:\d+|f))/i.exec(lineText);
			if (tblMatch && tblMatch[1] && tblMatch[2]) {
				const tableName = tblMatch[1].trim().toLowerCase();
				const dice = tblMatch[2];
				const table = tables.get(tableName);
				
				if (table) {
					notationToRoll = dice;
					const rollResult = DiceRoller.roll(dice);
					if (rollResult) {
						tableOutcome = TableResolver.resolveEntry(table, rollResult.total) || undefined;
						
						const newLineText = DiceRoller.formatResult(lineText, rollResult, {
							detailMode: this.settings.diceDetailMode,
							highLabel: this.settings.diceHighLabel,
							showHigh: this.settings.showDiceHigh,
							lowLabel: this.settings.diceLowLabel,
							showLow: this.settings.showDiceLow,
							tableOutcome
						});

						view.dispatch({
							changes: { from: line.from, to: line.to, insert: newLineText }
						});
						return;
					}
				}
			}
		}

		// Standard roll (non-table or table not found)
		const result = DiceRoller.roll(notationToRoll);
		if (result) {
			const newLineText = DiceRoller.formatResult(lineText, result, {
				detailMode: this.settings.diceDetailMode,
				highLabel: this.settings.diceHighLabel,
				showHigh: this.settings.showDiceHigh,
				lowLabel: this.settings.diceLowLabel,
				showLow: this.settings.showDiceLow,
			});

			view.dispatch({
				changes: { from: line.from, to: line.to, insert: newLineText }
			});
		}
	}

	ignoreEvent(): boolean {
		return false;
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
						trimmedLine.startsWith("gen:"))
				) {
					const notation = DiceRoller.extractNotation(lineText);
					if (notation) {
						decorations.push({
							from: line.to,
							to: line.to,
							value: Decoration.widget({
								widget: new DiceWidget(notation, lineNum, settings),
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
