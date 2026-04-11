/**
 * Table Resolver Utility for Lonelog
 * Handles parsing of inline table definitions and resolving entries based on dice rolls.
 */

export interface TableEntry {
	min: number;
	max: number;
	text: string;
}

export interface TableDefinition {
	name: string;
	dice: string;
	entries: TableEntry[];
}

export class TableResolver {
	/**
	 * Scans the provided text for tbl: definitions and parses them.
	 * Returns a map of table name (lowercase) to its definition.
	 */
	static parseTables(content: string): Map<string, TableDefinition> {
		const tables = new Map<string, TableDefinition>();
		const lines = content.split("\n");
		
		let currentTable: TableDefinition | null = null;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) continue;
			const trimmed = line.trim();

			// Ignore completely empty lines
			if (trimmed === "") continue;

			// Look for table header: tbl: Name (d6) or tbl: Name [Option A, ...]
			const headerMatch = /^\s*tbl:\s*([^(\[]+)(?:\(([^)]+)\)|\[([^\]]+)\])/i.exec(line);
			
			if (headerMatch && headerMatch[1]) {
				const name = headerMatch[1].trim();
				const dice = headerMatch[2] ? headerMatch[2].trim() : (headerMatch[3] ? "d" + headerMatch[3].split(",").length : "d6"); // Auto-detect dice for bracket sets if possible
				const optionsStr = headerMatch[3];

				currentTable = {
					name,
					dice,
					entries: []
				};
				tables.set(name.toLowerCase(), currentTable);

				// If we have options in brackets, treat them as a table with 1..N entries
				if (optionsStr) {
					const options = optionsStr.split(",").map(o => o.trim());
					options.forEach((opt, idx) => {
						currentTable?.entries.push({
							min: idx + 1,
							max: idx + 1,
							text: opt
						});
					});
					// If it's a bracket table, we don't look for indented lines
					currentTable = null;
				}
				continue;
			}

			// Look for entries if we are inside a table block (indented lines)
			if (currentTable && (line.startsWith(" ") || line.startsWith("\t"))) {
				// Pattern: N-M: Text or N: Text (flexible with spaces)
				const entryMatch = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*:\s*(.+)$/.exec(trimmed);
				if (entryMatch && entryMatch[1] && entryMatch[3]) {
					const min = parseInt(entryMatch[1]);
					const max = entryMatch[2] ? parseInt(entryMatch[2]) : min;
					const text = entryMatch[3].trim();
					
					currentTable.entries.push({ min, max, text });
				}
				continue;
			}

			// If we hit a non-indented line that isn't a table header, close the current table
			if (currentTable && trimmed !== "" && !line.startsWith("  ") && !line.startsWith("\t")) {
				currentTable = null;
			}
		}

		return tables;
	}

	/**
	 * Finds an entry in a table based on a value.
	 */
	static resolveEntry(table: TableDefinition, value: number): string | null {
		for (const entry of table.entries) {
			if (value >= entry.min && value <= entry.max) {
				return entry.text;
			}
		}
		return null;
	}

	/**
	 * Attempts to extract a table name and roll from a line.
	 * Example: "tbl: Forest Encounter d6=5"
	 * Returns { tableName: "Forest Encounter", rollValue: 5 }
	 */
	static parseRollLine(line: string): { tableName: string; value: number } | null {
		const match = /tbl:\s*([^=->\n]+)\s*(\d*d(?:\d+|f))?\s*=\s*([+-]?\d+)/i.exec(line);
		if (match && match[1] && match[3]) {
			return {
				tableName: match[1].trim().toLowerCase(),
				value: parseInt(match[3])
			};
		}
		return null;
	}
}
