import { createLonelogApi, isLonelogContent } from "../src/api";

describe("Lonelog public API", () => {
	test("detects Lonelog content markers", () => {
		expect(isLonelogContent("[N:Jonah|friendly]")).toBe(true);
		expect(isLonelogContent("```partylog\n@(Kael) Sneak\n```")).toBe(true);
		expect(isLonelogContent("plain markdown without notation")).toBe(false);
	});

	test("parses content through the public API", () => {
		const api = createLonelogApi({
			app: {
				vault: {
					read: jest.fn(),
				},
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			settings: { enablePartylogAddon: false } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		});

		const result = api.parse.content("[N:Jonah|friendly]");
		expect(result.npcs.has("Jonah")).toBe(true);
	});

	test("parses files through the public API", async () => {
		const read = jest.fn().mockResolvedValue("[Thread:Find Sister|Open]");
		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			settings: { enablePartylogAddon: false } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		});

		const result = await api.parse.file({ extension: "md" } as never);
		expect(read).toHaveBeenCalled();
		expect(result.threads.has("Find Sister")).toBe(true);
	});

	test("detects Lonelog notes from frontmatter and content", async () => {
		const read = jest.fn().mockResolvedValue("plain text");
		const getFileCache = jest.fn().mockReturnValue({
			frontmatter: {
				ruleset: "mythic",
			},
		});

		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: { getFileCache },
			} as never,
			settings: { enablePartylogAddon: false } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		});

		await expect(api.parse.isLonelogNote({ extension: "md" } as never)).resolves.toBe(true);
		expect(read).not.toHaveBeenCalled();

		read.mockResolvedValueOnce("[Clock:Ritual 2/6]");
		getFileCache.mockReturnValueOnce(undefined);
		await expect(api.parse.isLonelogNote({ extension: "md" } as never)).resolves.toBe(true);

		read.mockResolvedValueOnce("just text");
		getFileCache.mockReturnValueOnce(undefined);
		await expect(api.parse.isLonelogNote({ extension: "md" } as never)).resolves.toBe(false);
	});

	test("opens views through the public API", async () => {
		const activateView = jest.fn().mockResolvedValue(undefined);
		const showViewSelectorMenu = jest.fn();
		const api = createLonelogApi({
			app: {
				vault: {
					read: jest.fn(),
				},
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			settings: { enablePartylogAddon: true } as never,
			activateView,
			showViewSelectorMenu,
		});

		await api.views.openDashboard();
		await api.views.openPartylogDashboard();
		api.views.openViewSelector();

		expect(activateView).toHaveBeenCalledWith("lonelog-dashboard");
		expect(activateView).toHaveBeenCalledWith("lonelog-partylog-dashboard");
		expect(showViewSelectorMenu).toHaveBeenCalledWith(undefined);
	});

	test("returns a settings snapshot", () => {
		const settings = {
			enablePartylogAddon: true,
			locale: "en",
		};

		const api = createLonelogApi({
			app: {
				vault: {
					read: jest.fn(),
				},
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			settings: settings as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		});

		const snapshot = api.settings.get();
		expect(snapshot).toEqual(settings);
		expect(snapshot).not.toBe(settings);
	});
});
