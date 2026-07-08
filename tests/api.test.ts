import {
	createLonelogApi,
	hasPartylogBlocks,
	isLonelogContent,
	LONELOG_API_ERROR_CODES,
	LonelogApiError,
} from "../src/api";

describe("Lonelog public API", () => {
	test("detects Lonelog content markers", () => {
		expect(isLonelogContent("[N:Jonah|friendly]")).toBe(true);
		expect(isLonelogContent("```partylog\n@(Kael) Sneak\n```")).toBe(true);
		expect(isLonelogContent("plain markdown without notation")).toBe(false);
	});

	test("detects Partylog fenced blocks", () => {
		expect(hasPartylogBlocks("```partylog\n@(Kael) Sneak\n```")).toBe(true);
		expect(hasPartylogBlocks("[N:Jonah|friendly]")).toBe(false);
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
		}).api;

		const result = api.parse.content("[N:Jonah|friendly]");
		expect(result.npcs.has("Jonah")).toBe(true);
		const json = api.json.lonelog.content("[N:Jonah|friendly]");
		expect(json.npcs[0]?.name).toBe("Jonah");
	});

	test("returns JSON-friendly snapshots for addon domains", () => {
		const api = createLonelogApi({
			app: {
				vault: {
					read: jest.fn(),
				},
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			settings: {
				enableDungeonAddon: true,
				enableResourceAddon: true,
			} as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		const dungeon = api.json.dungeon.content("[R:12|open|Hallway|exits north]");
		const resources = api.json.resources.content("[Inv:Rope|1]\n[Wealth:Gold 12|Silver 4]");
		const combat = api.json.combat.content("[COMBAT]\n[PC:Kael|HP 5]\nRd2\n[/COMBAT]");
		const progress = api.json.progress.content("[Track:Escape 3/6]");

		expect(dungeon.rooms[0]?.id).toBe("12");
		expect(resources.inventory[0]?.name).toBe("Rope");
		expect(resources.wealth[0]).toEqual({ currency: "Gold", amount: "12" });
		expect(combat.encounters[0]?.currentRound).toBe(2);
		expect(progress.progress[0]?.name).toBe("Escape");
	});

	test("adapts content and active file into a single consumer snapshot", async () => {
		const read = jest.fn().mockResolvedValue("[N:Jonah|friendly]\n[Track:Escape 3/6]\n```partylog\n@(Kael) Sneak\n```");
		const activeFile = { extension: "md", path: "Notes/session.md" } as never;
		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: { getFileCache: jest.fn() },
				workspace: { getActiveFile: jest.fn().mockReturnValue(activeFile) },
			} as never,
			settings: { enablePartylogAddon: true } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		const contentSnapshot = api.adapters.content("[N:Jonah|friendly]\n[Track:Escape 3/6]");
		const fileSnapshot = await api.adapters.activeFile();

		expect(contentSnapshot.isLonelogNote).toBe(true);
		expect(contentSnapshot.lonelog.npcs[0]?.name).toBe("Jonah");
		expect(contentSnapshot.progress.progress[0]?.name).toBe("Escape");
		expect(fileSnapshot?.file).toBe(activeFile);
		expect(fileSnapshot?.hasPartylogBlocks).toBe(true);
		expect(fileSnapshot?.partylog.timeline[0]?.type).toBe("action");
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
		}).api;

		const result = await api.parse.file({ extension: "md" } as never);
		expect(read).toHaveBeenCalled();
		expect(result.threads.has("Find Sister")).toBe(true);
	});

	test("parses Partylog content through the public API", () => {
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
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		const result = api.parse.partylog.content("```partylog\n@(Kael) Sneak past the guard\n```");
		expect(result.hasPartylogBlocks).toBe(true);
		expect(result.timeline[0]?.type).toBe("action");
		const json = api.json.partylog.content("```partylog\n@(Kael) Sneak past the guard\n```");
		expect(json.timeline[0]?.type).toBe("action");
	});

	test("parses Partylog files through the public API", async () => {
		const read = jest.fn().mockResolvedValue("```partylog\n! The lantern falls\n```");
		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			settings: { enablePartylogAddon: true } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		const result = await api.parse.partylog.file({ extension: "md" } as never);
		expect(read).toHaveBeenCalled();
		expect(result.hasPartylogBlocks).toBe(true);
		expect(result.timeline[0]?.type).toBe("world-event");
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
		}).api;

		await expect(api.parse.isLonelogNote({ extension: "md" } as never)).resolves.toBe(true);
		expect(read).not.toHaveBeenCalled();

		read.mockResolvedValueOnce("[Clock:Ritual 2/6]");
		getFileCache.mockReturnValueOnce(undefined);
		await expect(api.parse.isLonelogNote({ extension: "md" } as never)).resolves.toBe(true);

		read.mockResolvedValueOnce("just text");
		getFileCache.mockReturnValueOnce(undefined);
		await expect(api.parse.isLonelogNote({ extension: "md" } as never)).resolves.toBe(false);
	});

	test("detects Partylog blocks from strings and files", async () => {
		const read = jest.fn().mockResolvedValue("```partylog\n?(GM) Is anyone watching?\n```");
		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			settings: { enablePartylogAddon: true } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		await expect(api.parse.partylog.hasBlocks("```partylog\n@(Kael) Sneak\n```")).resolves.toBe(true);
		await expect(api.parse.partylog.hasBlocks("[N:Jonah|friendly]")).resolves.toBe(false);
		await expect(api.parse.partylog.hasBlocks({ extension: "md" } as never)).resolves.toBe(true);
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
		}).api;

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
		}).api;

		const snapshot = api.settings.get();
		expect(snapshot).toEqual(settings);
		expect(snapshot).not.toBe(settings);
	});

	test("returns API capabilities", () => {
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
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		const capabilities = api.capabilities.get();
		expect(capabilities.apiVersion).toBe("1");
		expect(capabilities.adapters.content).toBe(true);
		expect(capabilities.adapters.file).toBe(true);
		expect(capabilities.adapters.activeFile).toBe(true);
		expect(capabilities.addons.dungeon).toBe(true);
		expect(capabilities.addons.partylog).toBe(true);
		expect(capabilities.errors.fileReadFailed).toBe(true);
		expect(capabilities.info.get).toBe(true);
		expect(capabilities.events.noteChanged).toBe(true);
		expect(capabilities.events.progressMutated).toBe(true);
		expect(capabilities.events.dungeonRoomUpserted).toBe(true);
		expect(capabilities.events.partylogEntryAppended).toBe(true);
		expect(capabilities.events.partylogTagMutated).toBe(true);
		expect(capabilities.events.combatCombatantUpdated).toBe(true);
		expect(capabilities.events.combatCombatantRemoved).toBe(true);
		expect(capabilities.json.lonelog).toBe(true);
		expect(capabilities.json.partylog).toBe(true);
		expect(capabilities.json.dungeon).toBe(true);
		expect(capabilities.json.resources).toBe(true);
		expect(capabilities.json.combat).toBe(true);
		expect(capabilities.json.progress).toBe(true);
		expect(capabilities.parsers.partylog).toBe(true);
		expect(capabilities.views.partylogDashboard).toBe(true);
	});

	test("returns addon status", () => {
		const api = createLonelogApi({
			app: {
				vault: { read: jest.fn() },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: {
				enableDungeonAddon: true,
				enableResourceAddon: false,
				enablePartylogAddon: true,
			} as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		expect(api.addons.getStatus()).toEqual({
			dungeon: true,
			resources: false,
			partylog: true,
		});
	});

	test("exposes dungeon addon API", async () => {
		const read = jest.fn().mockResolvedValue("[R:12|open|Hallway|exits north]");
		const activateView = jest.fn().mockResolvedValue(undefined);
		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: { enableDungeonAddon: true } as never,
			activateView,
			showViewSelectorMenu: jest.fn(),
		}).api;

		const rooms = api.dungeon.parseContent("[R:12|open|Hallway|exits north]");
		const roomsFromFile = await api.dungeon.parseFile({ extension: "md" } as never);
		await api.dungeon.openView();

		expect(api.dungeon.isEnabled()).toBe(true);
		expect(rooms.get("12")?.description).toBe("Hallway");
		expect(roomsFromFile.get("12")?.description).toBe("Hallway");
		expect(api.dungeon.listRooms("[R:12|open|Hallway|exits north]")).toHaveLength(1);
		expect(api.dungeon.getRoom("[R:12|open|Hallway|exits north]", "12")?.description).toBe("Hallway");
		expect(api.dungeon.getLatestRoom("[R:12|open|Hallway|exits north]", "12")?.description).toBe("Hallway");
		expect(activateView).toHaveBeenCalledWith("lonelog-dungeon-view");
	});

	test("serializes and mutates dungeon through the public API", async () => {
		const read = jest.fn().mockResolvedValue("[R:12|closed|Hallway|exits north]");
		const modify = jest.fn().mockResolvedValue(undefined);
		const roomEvent = jest.fn();
		const api = createLonelogApi({
			app: {
				vault: { read, modify },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: { enableDungeonAddon: true } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;
		api.events.on("dungeon-room-upserted", roomEvent);

		expect(api.dungeon.serialize.roomTag({
			id: "12",
			status: ["open"],
			description: "Hallway",
			exits: ["north"],
		})).toBe("[R:12|open|Hallway|exits north]");

		const updateResult = api.dungeon.mutate.upsertRoomInContent("[R:12|closed|Hallway|exits north]", {
			id: "12",
			status: ["open"],
			description: "Hallway",
			exits: ["north", "east"],
		});
		expect(updateResult.content).toBe("[R:12|open|Hallway|exits north, east]");
		expect(updateResult.updated).toBe(true);

		const fileResult = await api.dungeon.mutate.upsertRoomInFile({ extension: "md" } as never, {
			id: "12",
			status: ["open"],
			description: "Hallway",
			exits: ["north"],
		});
		expect(fileResult.content).toBe("[R:12|open|Hallway|exits north]");
		expect(modify).toHaveBeenCalledWith(expect.anything(), "[R:12|open|Hallway|exits north]");
		expect(roomEvent).toHaveBeenCalledWith(expect.objectContaining({
			tag: "[R:12|open|Hallway|exits north, east]",
			target: "content",
		}));

		const addStatus = api.dungeon.mutate.addStatusInContent("[R:12|open|Hallway|exits north]", "12", "lit");
		expect(addStatus.content).toBe("[R:12|open, lit|Hallway|exits north]");

		const removeStatus = api.dungeon.mutate.removeStatusInContent("[R:12|open, lit|Hallway|exits north]", "12", "lit");
		expect(removeStatus.content).toBe("[R:12|open|Hallway|exits north]");

		const addExit = api.dungeon.mutate.addExitInContent("[R:12|open|Hallway|exits north]", "12", "east");
		expect(addExit.content).toBe("[R:12|open|Hallway|exits north, east]");

		const removeExit = api.dungeon.mutate.removeExitInContent("[R:12|open|Hallway|exits north, east]", "12", "east");
		expect(removeExit.content).toBe("[R:12|open|Hallway|exits north]");
	});

	test("exposes resources addon API", async () => {
		const read = jest.fn().mockResolvedValue("[Inv:Torch|3]\n[Wealth:Gold 45]");
		const activateView = jest.fn().mockResolvedValue(undefined);
		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: { enableResourceAddon: true } as never,
			activateView,
			showViewSelectorMenu: jest.fn(),
		}).api;

		const parsed = api.resources.parseContent("[Inv:Torch|3]\n[Wealth:Gold 45]");
		const parsedFile = await api.resources.parseFile({ extension: "md" } as never);
		await api.resources.openView();

		expect(api.resources.isEnabled()).toBe(true);
		expect(parsed.inventory.get("Torch")?.quantity).toBe("3");
		expect(parsed.wealth.get("Gold")).toBe("45");
		expect(parsedFile.inventory.get("Torch")?.quantity).toBe("3");
		expect(api.resources.listInventory("[Inv:Torch|3]\n[Wealth:Gold 45]")).toHaveLength(1);
		expect(api.resources.getInventoryItem("[Inv:Torch|3]\n[Wealth:Gold 45]", "Torch")?.quantity).toBe("3");
		expect(api.resources.listWealth("[Inv:Torch|3]\n[Wealth:Gold 45]")).toEqual([{ currency: "Gold", amount: "45" }]);
		expect(activateView).toHaveBeenCalledWith("lonelog-resource-view");
	});

	test("serializes and mutates resources through the public API", async () => {
		const read = jest.fn().mockResolvedValue("[Wealth:Gold 10]");
		const modify = jest.fn().mockResolvedValue(undefined);
		const inventoryEvent = jest.fn();
		const wealthEvent = jest.fn();
		const inventoryMutationEvent = jest.fn();
		const api = createLonelogApi({
			app: {
				vault: { read, modify },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: { enableResourceAddon: true } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;
		api.events.on("resources-inventory-appended", inventoryEvent);
		api.events.on("resources-wealth-upserted", wealthEvent);
		api.events.on("resources-inventory-mutated", inventoryMutationEvent);

		expect(api.resources.serialize.inventoryTag({
			name: "Torch",
			quantity: 3,
			properties: ["lit"],
		})).toBe("[Inv:Torch|3|lit]");

		expect(api.resources.serialize.wealthTag({
			currencies: { Gold: 45, Silver: 12 },
		})).toBe("[Wealth:Gold 45|Silver 12]");
		expect(api.resources.serialize.inventoryDeltaTag({
			name: "Torch",
			delta: -1,
		})).toBe("[Inv:Torch-1]");
		expect(api.resources.serialize.inventoryPropertyTag({
			name: "Torch",
			add: ["lit"],
			remove: ["wet"],
		})).toBe("[Inv:Torch||+lit|-wet]");

		const appendResult = api.resources.mutate.appendInventoryToContent("Start", {
			name: "Torch",
			quantity: 3,
		});
		expect(appendResult.content).toBe("Start\n[Inv:Torch|3]");
		expect(appendResult.inserted).toBe(true);

		const setResult = api.resources.mutate.setInventoryItemInContent("Start", {
			name: "Rope",
			quantity: 1,
			properties: ["hemp"],
		});
		expect(setResult.content).toBe("Start\n[Inv:Rope|1|hemp]");

		const deltaResult = api.resources.mutate.adjustInventoryItemInContent("Start", {
			name: "Torch",
			delta: -1,
		});
		expect(deltaResult.content).toBe("Start\n[Inv:Torch-1]");

		const propsResult = api.resources.mutate.updateInventoryPropertiesInContent("Start", {
			name: "Torch",
			add: ["lit"],
			remove: ["wet"],
		});
		expect(propsResult.content).toBe("Start\n[Inv:Torch||+lit|-wet]");

		const moveResult = api.resources.mutate.moveInventoryItemInContent("Start", {
			name: "Torch",
			fromSlot: "Backpack 1",
			toSlot: "Backpack 2",
			quantity: 3,
		});
		expect(moveResult.content).toBe("Start\n[Inv:Backpack 1|-Torch]\n[Inv:Backpack 2|Torch×3]");

		const wealthResult = api.resources.mutate.upsertWealthInContent("[Wealth:Gold 10]", {
			currency: "Silver",
			amount: 5,
		});
		expect(wealthResult.content).toBe("[Wealth:Gold 10|Silver 5]");
		expect(wealthResult.updated).toBe(true);

		const fileResult = await api.resources.mutate.upsertWealthInFile({ extension: "md" } as never, {
			currency: "Gold",
			amount: 25,
		});
		expect(fileResult.content).toBe("[Wealth:Gold 25]");
		expect(modify).toHaveBeenCalledWith(expect.anything(), "[Wealth:Gold 25]");
		expect(inventoryEvent).toHaveBeenCalledWith(expect.objectContaining({
			target: "content",
			tag: "[Inv:Torch|3]",
		}));
		expect(inventoryMutationEvent).toHaveBeenCalledWith(expect.objectContaining({
			action: "move",
			tag: "[Inv:Backpack 1|-Torch]\n[Inv:Backpack 2|Torch×3]",
		}));
		expect(wealthEvent).toHaveBeenCalledWith(expect.objectContaining({
			tag: "[Wealth:Gold 10|Silver 5]",
		}));
	});

	test("exposes combat and progress addon APIs", async () => {
		const read = jest.fn().mockResolvedValue("[COMBAT]\n[F:Goblin|HP 4]\nRd2\n[/COMBAT]\n[Clock:Ritual 2/6]");
		const activateView = jest.fn().mockResolvedValue(undefined);
		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: {} as never,
			activateView,
			showViewSelectorMenu: jest.fn(),
		}).api;

		const combat = api.combat.parseContent("[COMBAT]\n[F:Goblin|HP 4]\nRd2\n[/COMBAT]");
		const progress = api.progress.parseContent("[Clock:Ritual 2/6]");
		const combatFromFile = await api.combat.parseFile({ extension: "md" } as never);
		const progressFromFile = await api.progress.parseFile({ extension: "md" } as never);

		await api.combat.openView();
		await api.progress.openView();

		expect(combat.length).toBeGreaterThanOrEqual(1);
		expect(progress[0]?.name).toBe("Ritual");
		expect(combatFromFile.length).toBeGreaterThanOrEqual(1);
		expect(api.combat.listEncounters("[COMBAT]\n[F:Goblin|HP 4]\nRd2\n[/COMBAT]")).toHaveLength(combat.length);
		expect(api.combat.getLatestEncounter("[COMBAT]\n[F:Goblin|HP 4]\nRd2\n[/COMBAT]")?.currentRound).toBe(2);
		expect(api.combat.getEncounter("[COMBAT]\n[F:Goblin|HP 4]\nRd2\n[/COMBAT]", combat[0]?.id ?? "")?.id).toBe(combat[0]?.id);
		expect(api.progress.list("[Clock:Ritual 2/6]")).toHaveLength(1);
		expect(api.progress.get("[Clock:Ritual 2/6]", "Ritual", "clock")?.current).toBe(2);
		expect(api.progress.getLatestTrack("[Track:Ritual 1/6]\n[Track:Ritual 3/6]", "Ritual")?.current).toBe(3);
		expect(progressFromFile.some((item) => item.name === "Ritual")).toBe(true);
		expect(activateView).toHaveBeenCalledWith("lonelog-combat-view");
		expect(activateView).toHaveBeenCalledWith("lonelog-progress-view");
	});

	test("serializes and mutates combat through the public API", async () => {
		const read = jest.fn().mockResolvedValue("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]");
		const modify = jest.fn().mockResolvedValue(undefined);
		const createdEvent = jest.fn();
		const combatantEvent = jest.fn();
		const updatedCombatantEvent = jest.fn();
		const removedCombatantEvent = jest.fn();
		const roundEvent = jest.fn();
		const closedEvent = jest.fn();
		const api = createLonelogApi({
			app: {
				vault: { read, modify },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: {} as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;
		api.events.on("combat-encounter-created", createdEvent);
		api.events.on("combat-combatant-added", combatantEvent);
		api.events.on("combat-combatant-updated", updatedCombatantEvent);
		api.events.on("combat-combatant-removed", removedCombatantEvent);
		api.events.on("combat-round-advanced", roundEvent);
		api.events.on("combat-encounter-closed", closedEvent);

		expect(api.combat.serialize.encounterBlock()).toBe("[COMBAT]\n\n[/COMBAT]");
		expect(api.combat.serialize.combatantTag({
			type: "foe",
			name: "Goblin",
			stats: ["HP 4"],
		})).toBe("[F:Goblin|HP 4]");
		expect(api.combat.serialize.roundLine(2)).toBe("Rd2");
		expect(api.combat.serialize.closeBlock()).toBe("[/COMBAT]");

		const createResult = api.combat.mutate.createEncounterInContent("Start");
		expect(createResult.content).toBe("Start\n[COMBAT]\n\n[/COMBAT]");

		const combatantResult = api.combat.mutate.addCombatantInContent("[COMBAT]\n[/COMBAT]", {
			type: "foe",
			name: "Goblin",
			stats: ["HP 4"],
		});
		expect(combatantResult.content).toBe("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]");

		const roundResult = api.combat.mutate.advanceRoundInContent("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]", 2);
		expect(roundResult.content).toBe("[COMBAT]\n[F:Goblin|HP 4]\nRd2\n[/COMBAT]");

		const encounterId = api.combat.parseContent("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]")[0]?.id ?? "";
		const targetedAdd = api.combat.mutate.addCombatantToEncounterInContent("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]", encounterId, {
			type: "pc",
			name: "Kael",
			stats: ["HP 5"],
		});
		expect(targetedAdd.content).toContain("[PC:Kael|HP 5]");

		const updatedCombatant = api.combat.mutate.updateCombatantInContent("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]", encounterId, {
			name: "Goblin",
			stats: ["HP 2"],
		});
		expect(updatedCombatant.content).toContain("[F:Goblin|HP 2]");

		const removedCombatant = api.combat.mutate.removeCombatantInContent("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]", encounterId, "Goblin");
		expect(removedCombatant.content).toBe("[COMBAT]\n[/COMBAT]");

		const targetedRound = api.combat.mutate.advanceRoundInEncounterInContent("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]", encounterId, 3);
		expect(targetedRound.content).toContain("Rd3");

		const multiEncounter = "[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]\n[COMBAT]\n[F:Orc|HP 8]\n[/COMBAT]";
		const firstEncounterId = api.combat.parseContent(multiEncounter)[0]?.id ?? "";
		const targetedClose = api.combat.mutate.closeEncounterByIdInContent(multiEncounter, firstEncounterId);
		expect(targetedClose.content).toContain("[/COMBAT]\n[/COMBAT]");

		const closeResult = api.combat.mutate.closeEncounterInContent("[COMBAT]\n[F:Goblin|HP 4]");
		expect(closeResult.content).toBe("[COMBAT]\n[F:Goblin|HP 4]\n[/COMBAT]");

		await api.combat.mutate.addCombatantInFile({ extension: "md" } as never, {
			type: "foe",
			name: "Goblin",
			stats: ["HP 4"],
		});
		expect(modify).toHaveBeenCalled();
		expect(createdEvent).toHaveBeenCalledWith(expect.objectContaining({ target: "content" }));
		expect(combatantEvent).toHaveBeenCalledWith(expect.objectContaining({ tag: "[F:Goblin|HP 4]" }));
		expect(updatedCombatantEvent).toHaveBeenCalledWith(expect.objectContaining({ tag: "[F:Goblin|HP 2]" }));
		expect(removedCombatantEvent).toHaveBeenCalledWith(expect.objectContaining({ name: "Goblin" }));
		expect(roundEvent).toHaveBeenCalledWith(expect.objectContaining({ roundLine: "Rd2" }));
		expect(closedEvent).toHaveBeenCalledWith(expect.objectContaining({ block: "[/COMBAT]" }));
	});

	test("serializes and mutates progress through the public API", async () => {
		const read = jest.fn().mockResolvedValue("[Track:Ritual 1/6]");
		const modify = jest.fn().mockResolvedValue(undefined);
		const progressEvent = jest.fn();
		const api = createLonelogApi({
			app: {
				vault: { read, modify },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: {} as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;
		api.events.on("progress-mutated", progressEvent);

		expect(api.progress.serialize.tag({
			kind: "clock",
			name: "Ritual",
			current: 2,
			max: 6,
		})).toBe("[Clock:Ritual 2/6]");

		const updateResult = api.progress.mutate.upsertInContent("[Track:Ritual 1/6]", {
			kind: "track",
			name: "Ritual",
			current: 3,
			max: 6,
		});
		expect(updateResult.content).toBe("[Track:Ritual 3/6]");
		expect(updateResult.updated).toBe(true);

		const insertResult = api.progress.mutate.upsertInContent("", {
			kind: "timer",
			name: "Dawn",
			current: 4,
		});
		expect(insertResult.content).toBe("[Timer:Dawn 4]");
		expect(insertResult.inserted).toBe(true);

		const fileResult = await api.progress.mutate.upsertInFile({ extension: "md" } as never, {
			kind: "track",
			name: "Ritual",
			current: 4,
			max: 6,
		});
		expect(fileResult.content).toBe("[Track:Ritual 4/6]");
		expect(modify).toHaveBeenCalledWith(expect.anything(), "[Track:Ritual 4/6]");
		expect(progressEvent).toHaveBeenCalledWith(expect.objectContaining({
			tag: "[Track:Ritual 3/6]",
			target: "content",
		}));
	});

	test("exposes partylog addon API", async () => {
		const read = jest.fn().mockResolvedValue("```partylog\n@(Kael) Sneak\n```");
		const activateView = jest.fn().mockResolvedValue(undefined);
		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: { enablePartylogAddon: true } as never,
			activateView,
			showViewSelectorMenu: jest.fn(),
		}).api;

		const parsed = api.partylog.parseContent("```partylog\n@(Kael) Sneak\n```");
		const parsedFile = await api.partylog.parseFile({ extension: "md" } as never);
		const hasBlocks = await api.partylog.hasBlocks({ extension: "md" } as never);
		const latestBlockIndex = api.partylog.getLatestBlockIndex("```partylog\n@(Kael) Sneak\n```\n\n```partylog\n! Alarm\n```");
		const openThreads = api.partylog.getOpenThreads("[Thread:Escort Prince|Open]\n[Thread:Old Debt|Closed]");
		const activeGoals = api.partylog.getActiveGoals("```partylog\n[Goal:Escort the Prince|Active]\n[Quest:Sunstone|Completed]\n```");
		const partyResource = api.partylog.getPartyResource("```partylog\n[Party:Gold 150|Rations 10]\n```", "Gold");
		await api.partylog.openView();

		expect(api.partylog.isEnabled()).toBe(true);
		expect(parsed.hasPartylogBlocks).toBe(true);
		expect(parsedFile.hasPartylogBlocks).toBe(true);
		expect(hasBlocks).toBe(true);
		expect(latestBlockIndex).toBe(1);
		expect(openThreads).toEqual([{ name: "Escort Prince", state: "Open" }]);
		expect(activeGoals).toEqual([{ name: "Escort the Prince", state: "Active", type: "goal" }]);
		expect(partyResource).toEqual({ key: "Gold", value: "150" });
		expect(activateView).toHaveBeenCalledWith("lonelog-partylog-dashboard");
	});

	test("serializes and mutates partylog through the public API", async () => {
		const read = jest.fn().mockResolvedValue("```partylog\n@(Kael) Sneak\n```");
		const modify = jest.fn().mockResolvedValue(undefined);
		const partylogEvent = jest.fn();
		const partylogTagEvent = jest.fn();
		const partylogMutationEvent = jest.fn();
		const api = createLonelogApi({
			app: {
				vault: { read, modify },
				metadataCache: { getFileCache: jest.fn() },
			} as never,
			settings: { enablePartylogAddon: true } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;
		api.events.on("partylog-entry-appended", partylogEvent);
		api.events.on("partylog-tag-appended", partylogTagEvent);
		api.events.on("partylog-tag-mutated", partylogMutationEvent);

		expect(api.partylog.serialize.entry({
			type: "action",
			actor: "Kael",
			text: "Sneak forward",
		})).toBe("@(Kael) Sneak forward");
		expect(api.partylog.serialize.entry({
			type: "dialogue",
			speakerType: "PC",
			actor: "Kael",
			text: "We move now",
		})).toBe('PC (Kael): "We move now"');
		expect(api.partylog.serialize.tag({
			type: "faction",
			name: "City Watch",
			tier: "2",
			standing: "neutral",
			tags: ["alert"],
		})).toBe("[Faction:City Watch|tier:2|standing:neutral|alert]");
		expect(api.partylog.serialize.tag({
			type: "party",
			entries: ["Gold 150", "Rations 10"],
		})).toBe("[Party:Gold 150|Rations 10]");
		expect(api.partylog.serialize.tag({
			type: "thread",
			name: "Escort the Prince",
			state: "Open",
		})).toBe("[Thread:Escort the Prince|Open]");

		const appendResult = api.partylog.mutate.appendEntryToContent("```partylog\n@(Kael) Sneak\n```", {
			type: "world-event",
			text: "A lantern falls",
		});
		expect(appendResult.content).toContain("! A lantern falls");
		expect(appendResult.updated).toBe(true);

		const tagResult = api.partylog.mutate.appendTagToContent("```partylog\n@(Kael) Sneak\n```", {
			type: "goal",
			name: "Escort the Prince",
			state: "Active",
		});
		expect(tagResult.content).toContain("[Goal:Escort the Prince|Active]");

		const blockAppend = api.partylog.mutate.appendEntryToBlockInContent("```partylog\n@(Kael) Sneak\n```\n\n```partylog\n! Alarm\n```", 0, {
			type: "question",
			text: "Who is there?",
		});
		expect(blockAppend.content).toContain("? Who is there?");

		const goalUpsert = api.partylog.mutate.upsertGoalInContent("```partylog\n[Goal:Escort the Prince|Active]\n```", {
			type: "goal",
			name: "Escort the Prince",
			state: "Completed",
		});
		expect(goalUpsert.content).toContain("[Goal:Escort the Prince|Completed]");

		const factionUpsert = api.partylog.mutate.upsertFactionInContent("```partylog\n[Faction:City Watch|tier:2|standing:neutral]\n```", {
			type: "faction",
			name: "City Watch",
			tier: "3",
			standing: "allied",
		});
		expect(factionUpsert.content).toContain("[Faction:City Watch|tier:3|standing:allied]");

		const threadUpsert = api.partylog.mutate.upsertThreadInContent("```partylog\n[Thread:Escort Prince|Open]\n```", {
			type: "thread",
			name: "Escort Prince",
			state: "Closed",
		});
		expect(threadUpsert.content).toContain("[Thread:Escort Prince|Closed]");

		const partyUpsert = api.partylog.mutate.upsertPartyInContent("```partylog\n[Party:Gold 150|Rations 10]\n```", {
			type: "party",
			entries: ["Gold 220", "Rations 8"],
		});
		expect(partyUpsert.content).toContain("[Party:Gold 220|Rations 8]");

		const fileResult = await api.partylog.mutate.appendEntryToFile({ extension: "md" } as never, {
			type: "consequence",
			text: "The guard turns",
		});
		expect(fileResult.content).toContain("=> The guard turns");
		expect(modify).toHaveBeenCalled();
		expect(partylogEvent).toHaveBeenCalledWith(expect.objectContaining({
			entry: "! A lantern falls",
			target: "content",
		}));
		expect(partylogTagEvent).toHaveBeenCalledWith(expect.objectContaining({
			tag: "[Goal:Escort the Prince|Active]",
			target: "content",
		}));
		expect(partylogMutationEvent).toHaveBeenCalledWith(expect.objectContaining({
			tag: "[Goal:Escort the Prince|Completed]",
			action: "upsert-goal",
		}));
	});

	test("returns API info metadata", () => {
		const api = createLonelogApi({
			app: {
				vault: {
					read: jest.fn(),
				},
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			manifest: {
				id: "lonelog",
				name: "Lonelog",
				version: "1.6.1",
				minAppVersion: "1.12.7",
			},
			settings: { enablePartylogAddon: true } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		expect(api.info.get()).toEqual({
			id: "lonelog",
			name: "Lonelog",
			version: "1.6.1",
			minAppVersion: "1.12.7",
			apiVersion: "1",
		});
		expect(api.info.getModules().resources).toEqual({
			name: "resources",
			version: "1",
			stability: "stable",
			deprecated: false,
			replacement: null,
		});
		expect(api.info.getStabilityPolicy()).toEqual({
			apiVersion: "1",
			defaultStability: "stable",
			additiveChangesWithinV1: true,
			breakingChangesRequireNewApiVersion: true,
			deprecatedSurfaceRemainsUntilNextApiVersion: true,
		});
	});

	test("emits public API events", async () => {
		const read = jest.fn().mockResolvedValue("```partylog\n@(Kael) Sneak\n```");
		const bundle = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			manifest: {
				id: "lonelog",
				name: "Lonelog",
				version: "1.6.1",
				minAppVersion: "1.12.7",
			},
			settings: { enablePartylogAddon: true, locale: "en" } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		});

		const settingsChanged = jest.fn<void, [{
			settings: { enablePartylogAddon?: boolean };
		}]>();
		const noteChanged = jest.fn<void, [{
			file: { path?: string };
			isLonelogNote: boolean;
			hasPartylogBlocks: boolean;
		}]>();
		const viewOpened = jest.fn<void, [{
			viewType: string;
		}]>();

		const settingsRef = bundle.api.events.on("settings-changed", settingsChanged);
		bundle.api.events.on("note-changed", noteChanged);
		bundle.api.events.on("view-opened", viewOpened);

		bundle.internal.emitSettingsChanged();
		await bundle.internal.emitNoteChanged({ extension: "md", path: "partylog.md" } as never);
		bundle.internal.emitViewOpened("lonelog-dashboard");
		bundle.api.events.offref(settingsRef);
		bundle.internal.emitSettingsChanged();

		const settingsPayload = settingsChanged.mock.calls[0]?.[0];
		const notePayload = noteChanged.mock.calls[0]?.[0];

		expect(settingsChanged).toHaveBeenCalledTimes(1);
		expect(settingsPayload?.settings.enablePartylogAddon).toBe(true);
		expect(notePayload?.file.path).toBe("partylog.md");
		expect(notePayload?.isLonelogNote).toBe(true);
		expect(notePayload?.hasPartylogBlocks).toBe(true);
		expect(viewOpened).toHaveBeenCalledWith({
			viewType: "lonelog-dashboard",
		});
	});

	test("exposes the public error contract", async () => {
		const read = jest.fn().mockRejectedValue(new Error("disk problem"));
		const api = createLonelogApi({
			app: {
				vault: { read },
				metadataCache: {
					getFileCache: jest.fn(),
				},
			} as never,
			settings: { enablePartylogAddon: true } as never,
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		await expect(api.parse.file({
			extension: "md",
			path: "Campaign.md",
		} as never)).rejects.toMatchObject({
			name: "LonelogApiError",
			code: LONELOG_API_ERROR_CODES.FILE_READ_FAILED,
		});

		expect(api.errors.codes.FILE_READ_FAILED).toBe("FILE_READ_FAILED");
		expect(api.errors.isLonelogApiError(new LonelogApiError(
			LONELOG_API_ERROR_CODES.FILE_READ_FAILED,
			"failed"
		))).toBe(true);
		expect(api.errors.isLonelogApiError(new Error("plain error"))).toBe(false);
	});

	test("rejects non-markdown files for file parsing", async () => {
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
			activateView: jest.fn().mockResolvedValue(undefined),
			showViewSelectorMenu: jest.fn(),
		}).api;

		await expect(api.parse.file({ extension: "png" } as never)).rejects.toMatchObject({
			code: LONELOG_API_ERROR_CODES.INVALID_FILE_TYPE,
		});
		await expect(api.parse.partylog.file({ extension: "json" } as never)).rejects.toMatchObject({
			code: LONELOG_API_ERROR_CODES.INVALID_FILE_TYPE,
		});
	});
});
