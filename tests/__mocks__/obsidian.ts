/**
 * Obsidian package mocks for testing.
 *
 * Obsidian package ships only type declarations, functions aren't available during testing.
 * Implement their minimal functionality to test some of the logic using those functions.
 */

import { FrontMatterInfo } from "obsidian";

/**
 * Tries to find anything looking like YAML frontmatter from the given `content`.
 * Considers anything enclosed in `---\n ... ---\n` as valid enough frontmatter.
 * Returns a proper obsidian `FrontMatterInfo` object based on what it found.
 */
export function getFrontMatterInfo(content: string): FrontMatterInfo {
	const match = /^---\r?\n([\s\S]*?\r?\n)?---\r?\n/.exec(content);

	if (!match) {
		return { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
	}

	const markerSize = "---\n".length;
	const frontmatter = match[1] ?? "";

	return {
		exists: true,
		frontmatter,
		from: markerSize,
		to: markerSize + frontmatter.length + markerSize,
		contentStart: match[0].length,
	};
}

/**
 * Simple frontmatter YAML parser.
 * Parses only `key: value` data.
 */
export function parseYaml(yaml: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const line of yaml.split("\n")) {
		const match = /^([^:\s]+):\s*(.+)$/.exec(line);
		if (match) {
			result[match[1]!.trim()] = match[2]!.replace(/^["']|["']$/g, "");
		}
	}
	return result;
}
