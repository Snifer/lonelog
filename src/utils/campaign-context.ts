/**
 * Campaign Context
 * Collects the files that make up a campaign (the active file's folder,
 * depending on the file scope setting) and reads them as one document.
 */

import { App, Component, MarkdownView, Notice, TAbstractFile, TFile, debounce } from "obsidian";
import { t } from "../i18n/i18n";
import {
	buildCampaignContent,
	CampaignContent,
	CampaignContentMode,
	CampaignScope,
	lineOffsetOf,
	resolveLine,
	selectCampaignFiles,
} from "./campaign-content";

export interface Campaign extends CampaignContent<TFile> {
	activeFile: TFile;
	files: TFile[];
	scope: CampaignScope;
}

/**
 * Sorted list of files to include in the campaign, see `selectCampaignFiles()`.
 * Non-markdown files and files without a folder are always a campaign of their own.
 */
export function getCampaignFiles(activeFile: TFile, scope: CampaignScope, mode: CampaignContentMode): TFile[] {
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
	refresh: () => void
): void {
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
