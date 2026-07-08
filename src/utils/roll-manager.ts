/**
 * Roll Manager Utility
 * Shared logic for processing lines with dice notation and table resolution.
 */

import { DiceRoller } from "./dice-roller";
import { AdvancedDiceRoller } from "./advanced-dice-roller";
import { TableResolver, TableDefinition } from "./table-resolver";
import { LonelogSettings } from "../settings";

export class RollManager {
	/**
	 * Processes a single line of text, rolling dice and resolving tables if applicable.
	 * Returns the modified line text, or the original if nothing was changed.
	 */
	static processLine(
		lineText: string,
		settings: LonelogSettings,
		tables: Map<string, TableDefinition>
	): string {
		const notation = DiceRoller.extractNotation(lineText);
		if (!notation) return lineText;

		let notationToRoll: string = notation;
		let tableOutcome: string | undefined;
		const trimmed = String(lineText).trimStart().toLowerCase();

		// --- Case A: Explicit tbl: roll ---
		if (trimmed.startsWith("tbl:")) {
			const tblMatch = /tbl:\s*(.+?)\s*(\d*d(?:\d+|f))/i.exec(lineText);
			if (tblMatch && tblMatch[1] && tblMatch[2]) {
				const tableName = tblMatch[1].trim().toLowerCase();
				const dice = tblMatch[2];
				const table = tables.get(tableName);

				if (table) {
					notationToRoll = dice;
					const rollResult = settings.enableDiceNotationAddon
						? AdvancedDiceRoller.roll(dice)
						: DiceRoller.roll(dice);

					if (rollResult) {
						tableOutcome = TableResolver.resolveEntry(table, rollResult.total) || undefined;
						return DiceRoller.formatResult(lineText, rollResult, {
							detailMode: settings.diceDetailMode,
							highLabel: settings.diceHighLabel,
							showHigh: settings.showDiceHigh,
							lowLabel: settings.diceLowLabel,
							showLow: settings.showDiceLow,
							tableOutcome,
							roller: settings.enableDiceNotationAddon
								? (notation: string) => AdvancedDiceRoller.roll(notation)
								: (notation: string) => DiceRoller.roll(notation)
						});
					}
				}
			}
		}

		// --- Case B: Generator label roll (e.g. "  Apariencia: d3") ---
		const labelMatch = /^\s*([^:([]+):\s*(\d*d(?:\d+|f))/i.exec(lineText);
		if (labelMatch && labelMatch[1] && labelMatch[2]) {
			const label = labelMatch[1].trim().toLowerCase();
			const dice = labelMatch[2];
			const table = tables.get(label);

			if (table) {
				notationToRoll = dice;
				const rollResult = settings.enableDiceNotationAddon
					? AdvancedDiceRoller.roll(dice)
					: DiceRoller.roll(dice);

				if (rollResult) {
					tableOutcome = TableResolver.resolveEntry(table, rollResult.total) || undefined;
					return DiceRoller.formatResult(lineText, rollResult, {
						detailMode: settings.diceDetailMode,
						highLabel: settings.diceHighLabel,
						showHigh: settings.showDiceHigh,
						lowLabel: settings.diceLowLabel,
						showLow: settings.showDiceLow,
						tableOutcome,
						roller: settings.enableDiceNotationAddon
							? (notation: string) => AdvancedDiceRoller.roll(notation)
							: (notation: string) => DiceRoller.roll(notation)
					});
				}
			}
		}

		// --- Case C: Standard roll ---
		const result = settings.enableDiceNotationAddon
			? AdvancedDiceRoller.roll(notationToRoll)
			: DiceRoller.roll(notationToRoll);

		if (result) {
			return DiceRoller.formatResult(lineText, result, {
				detailMode: settings.diceDetailMode,
				highLabel: settings.diceHighLabel,
				showHigh: settings.showDiceHigh,
				lowLabel: settings.diceLowLabel,
				showLow: settings.showDiceLow,
				roller: settings.enableDiceNotationAddon
					? (notation: string) => AdvancedDiceRoller.roll(notation)
					: (notation: string) => DiceRoller.roll(notation)
			});
		}

		return lineText;
	}
}
