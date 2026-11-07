/**
 * Campaign Content
 * Joins several files into one virtual document so the parsers can carry states
 * across files, and maps line numbers of that document back to the original files.
 */

import { getFrontMatterInfo, parseYaml } from "obsidian";
import { LonelogFrontmatter } from "../commands/frontmatter";

/**
 * Which file(s) are considered as the campaign content:
 * - "file": only the active file
 * - "folder": every file in the active file's folder
 * - "folder-until-active": files in the folder up to and including the active file
 */
export const CAMPAIGN_SCOPES = ["file", "folder", "folder-until-active"] as const;
export type CampaignScope = (typeof CAMPAIGN_SCOPES)[number];

/**
 * Check if the given `value` is a valid `CampaignScope` value
 */
export function isCampaignScope(value: unknown): value is CampaignScope {
	return CAMPAIGN_SCOPES.some((scope) => scope === value);
}

/**
 * What the campaign content is used for:
 * - "view": dashboards and sidebar views, showing everything the scope covers
 * - "edit": editor features like autocomplete and scene numbering, which only look at
 *   the files up to and including the active file, regardless of scope
 */
export type CampaignContentMode = "view" | "edit";

export interface CampaignSegment<T> {
	file: T;
	startLine: number;
	lineOffset: number;
	lineCount: number;
}

export interface CampaignContent<T> {
	frontmatter: LonelogFrontmatter;
	content: string;
	segments: CampaignSegment<T>[];
}

/**
 * Join campaign file contents together and record each file's
 * starting line number within the resulting combined document.
 * Extract frontmatter information for campaign metadata.
 */
export function buildCampaignContent<T>(
	parts: Array<{ file: T; content: string }>
): CampaignContent<T> {
	const segments: CampaignSegment<T>[] = [];
	const contents: string[] = []
	let frontmatter: LonelogFrontmatter = {}
	let content = "";
	let startLine = 0;

	for (const part of parts) {
		const frontmatterInfo = getFrontMatterInfo(part.content);
		if (frontmatterInfo.exists && !frontmatter?.title) {
			// parse *any* frontmatter as long as there's no title set yet
			frontmatter = parseYaml(frontmatterInfo.frontmatter);
		}

		// strip frontmatter from the content
		content = part.content.substring(frontmatterInfo.contentStart);
		contents.push(content)

		const lineCount = content.split("\n").length;
		const lineOffset = part.content.split("\n").length - lineCount;

		segments.push({ file: part.file, startLine, lineOffset, lineCount });
		startLine += lineCount;
	}

	return {
		frontmatter: frontmatter?.title ? frontmatter : {},
		content: contents.join("\n"),
		segments,
	};
}

/**
 * Map a line of the combined document back to its file and local line
 */
export function resolveLine<T>(
	segments: CampaignSegment<T>[],
	line: number
): { file: T; line: number } | null {
	for (const segment of segments) {
		if (line >= segment.startLine && line < segment.startLine + segment.lineCount) {
			return { file: segment.file, line: line - segment.startLine + segment.lineOffset };
		}
	}
	return null;
}

/**
 * Line within the combined document where the given `file`'s content starts
 */
export function lineOffsetOf<T>(segments: CampaignSegment<T>[], file: T): number | null {
	const segment = segments.find((s) => s.file === file);
	return segment ? segment.startLine : null;
}

/**
 * File name order, matching Obsidian's file explorer "File name (A to Z)"
 */
export function compareFileNames(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true });
}

/**
 * Alphabetically sorted list of files to include in the campaign, picked from the
 * Markdown files in the active file's folder (which includes the active file itself).
 *
 * Depending on `scope` and `mode`, returns either one of:
 *  - all the files in the folder (`folder` scope in `view` mode)
 *  - all the files up to and including the active file (`folder-until-active` scope or `folder` scope in `edit` mode)
 *  - only the active file itself (`file` scope in any mode)
 */
export function selectCampaignFiles<T extends { name: string }>(
	folderFiles: T[],
	activeFile: T,
	scope: CampaignScope,
	mode: CampaignContentMode
): T[] {
	// Anything but the two folder scopes is treated as a single-file campaign
	if (scope !== "folder" && scope !== "folder-until-active") return [activeFile];

	const sorted = [...folderFiles].sort((a, b) => compareFileNames(a.name, b.name));
	const index = sorted.indexOf(activeFile);
	if (index === -1) return [activeFile];

	if (mode === "edit" || scope === "folder-until-active") {
		return sorted.slice(0, index + 1);
	}
	return sorted;
}
