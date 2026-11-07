/**
 * Campaign Handling
 *
 * Collects all files that make up a campaign, based on the CampaignScope setting:
 *  - single-file campaigns using only the currently active file
 *  - multi-file campaigns using all files in a common directory
 *  - multi-file campaigns using all files up to and including the active file in a common directory
 *
 * Reads the relevant files, separates frontmatter and content, and (if multi-file campaign)
 * combines all individual file contents into one content block. All parsing and references
 * used by Lonelog itself happens on that combined content block then.
 */

import {
	App,
	Component,
	debounce,
	getFrontMatterInfo,
	MarkdownView,
	Notice,
	parseYaml,
	TAbstractFile,
	TFile
} from "obsidian";
import { t } from "../i18n/i18n";
import { LonelogFrontmatter } from "../commands/frontmatter";

/** How long to wait for further file changes before refreshing a view */
const CAMPAIGN_REFRESH_DELAY_MS = 300;

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
type CampaignContentMode = "view" | "edit";

interface CampaignSegment<T> {
	file: T;
	startLine: number;
	lineOffset: number;
	lineCount: number;
}

interface CampaignContent<T> {
	frontmatter: LonelogFrontmatter;
	content: string;
	segments: CampaignSegment<T>[];
}

export interface Campaign extends CampaignContent<TFile> {
	activeFile: TFile;
	files: TFile[];
	scope: CampaignScope;
}

/**
 * Build and return the campaign content from the given file chunks.
 *
 * Records each file's starting line number within the resulting combined document,
 * the file content's line count, and the frontmatter offset line count.
 * Extracts, strips, and returns frontmatter from the files, if any is present.
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

/**
 * Sorted list of files to include in the campaign, see `selectCampaignFiles()`.
 * Non-markdown files and files without a folder are always a campaign of their own.
 */
function getCampaignFiles(activeFile: TFile, scope: CampaignScope, mode: CampaignContentMode): TFile[] {
	if (scope === "file" || !activeFile.parent || activeFile.extension !== "md") {
		return [activeFile];
	}

	const folderFiles = activeFile.parent.children
		.filter((f): f is TFile => f instanceof TFile && f.extension === "md");
	return selectCampaignFiles(folderFiles, activeFile, scope, mode);
}

/**
 * Read the campaign files and join them into one document.
 *
 * If the `liveContent` data is set, the currently active file's content
 * is taken straight from there instead of reading it back from disk.
 * This is the case when the current file is opened in edit mode.
 */
export async function loadCampaign(
	app: App,
	activeFile: TFile,
	scope: CampaignScope,
	mode: CampaignContentMode = "view",
	liveContent?: string,
): Promise<Campaign> {
	const files = getCampaignFiles(activeFile, scope, mode);
	const parts = await Promise.all(
		files.map(async (file) => ({
			file,
			content: file === activeFile && liveContent !== undefined
				? liveContent
				: await app.vault.cachedRead(file),
		}))
	);

	return { ...buildCampaignContent(parts), activeFile, files, scope };
}

/**
 * Content for editor commands: the earlier campaign files followed by the live
 * editor content, and the line where the editor content starts.
 */
export interface EditorContext {
	content: string;
	lineOffset: number;
}

/**
 * Single-file campaign editor context. Only the live editor content, nothing is read from disk.
 */
export function singleFileContext(liveContent: string): EditorContext {
	return { content: liveContent, lineOffset: 0 };
}

/**
 * Campaign scope-specific editor context.
 * For single-file campaigns, the live editor content is used.
 * For multi-file campaigns, the whole campaign content is used.
 */
export async function loadEditorContext(
	app: App,
	file: TFile | null,
	scope: CampaignScope,
	liveContent: string
): Promise<EditorContext> {
	if (!file || scope === "file") return singleFileContext(liveContent);

	const campaign = await loadCampaign(app, file, scope, "edit", liveContent);
	return {
		content: campaign.content,
		lineOffset: lineOffsetOf(campaign.segments, file) ?? 0,
	};
}

/**
 * The campaign's display name, either the campaign folder name or the single file name
 */
export function getCampaignTitle(app: App, campaign: Campaign): string {
	if (campaign.frontmatter.title !== undefined) return campaign.frontmatter.title;
	if (campaign.scope === "file") return campaign.activeFile.basename;
	const folder = campaign.activeFile.parent;
	if (!folder) return campaign.activeFile.basename;
	return folder.isRoot() ? app.vault.getName() : folder.name;
}

/**
 * Open the original file containing the given `line` number of the
 * combined campaign document, and move the cursor to the corresponding
 * location within the original file.
 *
 * If using single-file campaign scope, it's just the active file itself.
 */
export async function openCampaignLine(app: App, campaign: Campaign | null, line: number): Promise<void> {
	if (!campaign) return;
	const target = resolveLine(campaign.segments, line);
	if (!target) return;

	try {
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(target.file, { eState: { line: target.line } });
		app.workspace.setActiveLeaf(leaf, { focus: true });

		// Use this tab's own view, `workspace.activeEditor` might still be another editor
		if (leaf.view instanceof MarkdownView) {
			const editor = leaf.view.editor;
			// Make sure the position is still valid in case the file was truncated since it was read
			const pos = { line: Math.min(target.line, editor.lastLine()), ch: 0 };
			editor.setCursor(pos);
			editor.scrollIntoView({ from: pos, to: pos }, true);
		}
	} catch (error) {
		console.error("Error opening campaign file:", error);
		new Notice(t("views.open-file-failed"));
	}
}

/**
 * Call the given `refresh` function whenever a campaign file content
 * or the campaign folder's content changes (add, remove, modify file).
 */
export function registerCampaignRefresh(
	component: Component,
	app: App,
	getCampaign: () => Campaign | null,
	onChange: () => void
): void {
	const refresh = debounce(onChange, CAMPAIGN_REFRESH_DELAY_MS, true);
	component.register(() => refresh.cancel());

	const inCampaignFolder = (path: string): boolean => {
		const campaign = getCampaign();
		if (!campaign || campaign.scope === "file" || !path.endsWith(".md")) return false;
		const slash = path.lastIndexOf("/");
		const folderPath = slash === -1 ? "/" : path.slice(0, slash);
		return folderPath === campaign.activeFile.parent?.path;
	};

	component.registerEvent(
		app.vault.on("modify", (file: TAbstractFile) => {
			const campaign = getCampaign();
			if (campaign && file instanceof TFile && campaign.files.includes(file)) refresh();
		})
	);
	component.registerEvent(
		app.vault.on("create", (file: TAbstractFile) => {
			if (inCampaignFolder(file.path)) refresh();
		})
	);
	component.registerEvent(
		app.vault.on("delete", (file: TAbstractFile) => {
			if (inCampaignFolder(file.path)) refresh();
		})
	);
	component.registerEvent(
		app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
			if (inCampaignFolder(file.path) || inCampaignFolder(oldPath)) refresh();
		})
	);
}
