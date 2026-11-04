import {
	buildCampaignContent,
	compareFileNames,
	isCampaignScope,
	lineOffsetOf,
	resolveLine,
	selectCampaignFiles,
} from "../src/utils/campaign-content";
import { NotationParser } from "../src/utils/parser";

describe("Campaign content", () => {
	test("joins notes and records where each starts", () => {
		const campaign = buildCampaignContent([
			{ file: "a", content: "one\ntwo" },
			{ file: "b", content: "three\n" },
			{ file: "c", content: "" },
			{ file: "d", content: "four" },
		]);

		expect(campaign.content).toBe("one\ntwo\nthree\n\n\nfour");
		expect(campaign.segments).toEqual([
			{ file: "a", startLine: 0, lineCount: 2 },
			{ file: "b", startLine: 2, lineCount: 2 },
			{ file: "c", startLine: 4, lineCount: 1 },
			{ file: "d", startLine: 5, lineCount: 1 },
		]);
	});

	test("maps combined lines back to notes", () => {
		const { content, segments } = buildCampaignContent([
			{ file: "a", content: "one\ntwo" },
			{ file: "b", content: "three\n" },
			{ file: "c", content: "four" },
		]);
		const lines = content.split("\n");

		expect(resolveLine(segments, 0)).toEqual({ file: "a", line: 0 });
		expect(resolveLine(segments, 1)).toEqual({ file: "a", line: 1 });
		expect(resolveLine(segments, 2)).toEqual({ file: "b", line: 0 });
		expect(resolveLine(segments, 3)).toEqual({ file: "b", line: 1 }); // empty lines count too
		expect(resolveLine(segments, 4)).toEqual({ file: "c", line: 0 });
		expect(lines[4]).toBe("four");
		expect(resolveLine(segments, 5)).toBeNull();
		expect(lineOffsetOf(segments, "c")).toBe(4);
		expect(lineOffsetOf(segments, "x")).toBeNull();
	});

	test("sorts note names naturally", () => {
		const names = ["Session 10.md", "session 4.md", "Session 2.md", "Session 03.md", "Session 1.md"];
		expect(names.sort(compareFileNames)).toEqual(["Session 1.md", "Session 2.md", "Session 03.md", "session 4.md", "Session 10.md"]);
	});

	test("carries Lonelog state across notes", () => {
		const { content, segments } = buildCampaignContent([
			{ file: "01", content: "## Session 1\n[Thread:Find the key|Open]\n[Wealth:Gold 10]\n[N:Jonah|friendly]" },
			{ file: "02", content: "## Session 2\n[Wealth:Gold+5]\n[Thread:Find the key|Closed]" },
		]);
		const parsed = NotationParser.parse(content);

		const thread = parsed.threads.get("Find the key")!;
		expect(thread.state).toBe("Closed");
		expect(resolveLine(segments, thread.firstMention)).toEqual({ file: "01", line: 1 });
		expect(resolveLine(segments, thread.lastMention)).toEqual({ file: "02", line: 2 });

		expect(parsed.wealth.get("Gold")).toBe("15");
		expect(parsed.npcs.has("Jonah")).toBe(true);
		expect(parsed.sessions.map((s) => s.number)).toEqual([1, 2]);
	});
});

describe("Campaign scope", () => {
	const s1 = { name: "Session 1.md" };
	const s2 = { name: "Session 2.md" };
	const s3 = { name: "Session 3.md" };
	const s10 = { name: "Session 10.md" };
	// Deliberately not in name order, to check the files get sorted
	const files = [s10, s2, s1, s3];
	const names = (selected: Array<{ name: string }>) => selected.map((f) => f.name);

	test("recognises the known scopes only", () => {
		expect(isCampaignScope("file")).toBe(true);
		expect(isCampaignScope("folder")).toBe(true);
		expect(isCampaignScope("folder-until-active")).toBe(true);
		expect(isCampaignScope("Folder")).toBe(false);
		expect(isCampaignScope("")).toBe(false);
		expect(isCampaignScope(undefined)).toBe(false);
		expect(isCampaignScope(1)).toBe(false);
	});

	test("file scope is only the active file, in any mode", () => {
		expect(selectCampaignFiles(files, s2, "file", "view")).toEqual([s2]);
		expect(selectCampaignFiles(files, s2, "file", "edit")).toEqual([s2]);
	});

	test("folder scope shows every file in natural name order in view mode", () => {
		expect(names(selectCampaignFiles(files, s2, "folder", "view"))).toEqual(["Session 1.md", "Session 2.md", "Session 3.md", "Session 10.md"]);
		// Same campaign whichever file is active
		expect(selectCampaignFiles(files, s10, "folder", "view")).toEqual(selectCampaignFiles(files, s1, "folder", "view"));
	});

	test("folder scope only goes up to the active file in edit mode", () => {
		expect(names(selectCampaignFiles(files, s2, "folder", "edit"))).toEqual(["Session 1.md", "Session 2.md"]);
		expect(names(selectCampaignFiles(files, s1, "folder", "edit"))).toEqual(["Session 1.md"]);
		expect(names(selectCampaignFiles(files, s10, "folder", "edit"))).toEqual(["Session 1.md", "Session 2.md", "Session 3.md", "Session 10.md"]);
	});

	test("folder-until-active scope goes up to the active file in both modes", () => {
		expect(names(selectCampaignFiles(files, s3, "folder-until-active", "view"))).toEqual(["Session 1.md", "Session 2.md", "Session 3.md"]);
		expect(selectCampaignFiles(files, s3, "folder-until-active", "edit")).toEqual(selectCampaignFiles(files, s3, "folder-until-active", "view"));
	});

	test("falls back to the active file if it is not among the folder's files", () => {
		const stranger = { name: "Notes.md" };
		expect(selectCampaignFiles(files, stranger, "folder", "view")).toEqual([stranger]);
	});

	test("treats an unknown scope as a single-file campaign", () => {
		expect(selectCampaignFiles(files, s2, "everything" as never, "view")).toEqual([s2]);
	});

	test("does not reorder the list it was given", () => {
		const original = [...files];
		selectCampaignFiles(files, s2, "folder", "view");
		expect(files).toEqual(original);
	});
});
