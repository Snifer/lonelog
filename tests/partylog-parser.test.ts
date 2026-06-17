import { PartylogParser } from "../src/utils/partylog-parser";
import { NotationParser } from "../src/utils/parser";

describe("PartylogParser", () => {
	beforeEach(() => {
		NotationParser.clearCache();
	});

	test("detects partylog blocks and extracts timeline entries", () => {
		const content = `
## Session 7
### S18 *Sewer tunnels beneath the estate*

\`\`\`partylog
@(Kael) Sneak past the guard
d(Kael): Stealth d20+5=8 vs DC 14 -> Fail
=> Kicks a bottle. Guard turns!
! Guard draws his blade and advances
\`\`\`
`;

		const parsed = PartylogParser.parse(content);

		expect(parsed.hasPartylogBlocks).toBe(true);
		expect(parsed.blockCount).toBe(1);
		expect(parsed.timeline).toHaveLength(4);
		expect(parsed.timeline[0]?.type).toBe("action");
		expect(parsed.timeline[1]?.type).toBe("dice");
		expect(parsed.timeline[2]?.type).toBe("consequence");
		expect(parsed.timeline[3]?.type).toBe("world-event");
		expect(parsed.timeline[0]?.sceneNumber).toBe("S18");
		expect(parsed.timeline[0]?.sceneContext).toBe("Sewer tunnels beneath the estate");
	});

	test("builds roster data from attributed actions, questions, dialogue, and rolls", () => {
		const content = `
\`\`\`partylog
@(Kael+Mira) Force open the heavy door
d(Kael): Athletics d20+5=18 -> Success
?(Sable asks) Is anyone behind it?
-> No, and...
PC(Kael): "Push harder."
\`\`\`
`;

		const parsed = PartylogParser.parse(content);

		expect(parsed.roster.get("Kael")?.actionCount).toBe(1);
		expect(parsed.roster.get("Kael")?.rollCount).toBe(1);
		expect(parsed.roster.get("Kael")?.dialogueCount).toBe(1);
		expect(parsed.roster.get("Mira")?.actionCount).toBe(1);
		expect(parsed.roster.get("Sable")?.questionCount).toBe(1);
		expect(parsed.timeline[0]?.actorMode).toBe("group");
		expect(parsed.timeline[2]?.type).toBe("question");
		expect(parsed.timeline[3]?.type).toBe("oracle-answer");
	});

	test("reuses shared parser data for partylog-compatible tags", () => {
		const content = `
## Session 1
### S1 *Dark alley*

\`\`\`partylog
@(Kael) Meet the informant
=> [N:Whisper Jack|nervous|knows rumors]
=> [Thread:Find the Missing Merchant|Open]
=> [PC:Kael|HP 28/28|Class:Rogue]
\`\`\`
`;

		const parsed = PartylogParser.parse(content);

		expect(parsed.npcs.has("Whisper Jack")).toBe(true);
		expect(parsed.threads.get("Find the Missing Merchant")?.state).toBe("Open");
		expect(parsed.pcs.has("Kael")).toBe(true);
		expect(parsed.sessions).toHaveLength(1);
	});

	test("parses party resources, factions, goals, quests, loot, advancements, and ooc tags", () => {
		const content = `
## Session 7
### End of Session 7
\`\`\`partylog
[Party:Gold 150|Rations 10|Wagon:intact]
[Faction:City Watch|tier:2|standing:neutral]
[Goal:Escort the Prince to Northport|Active]
[Quest:The Sunstone Conspiracy|Main]
=> [Loot: Ancient Silver Ring | unassigned]
[Advance:Kael|Rogue 6|+Expertise]
[OOC: Break | 15 mins]
(hook: the shipment arrives in 3 days)
\`\`\`
`;

		const parsed = PartylogParser.parse(content);

		expect(parsed.partyResources.get("Gold")?.value).toBe("150");
		expect(parsed.partyResources.get("Wagon")?.value).toBe("intact");
		expect(parsed.factions.get("City Watch")?.tier).toBe("2");
		expect(parsed.factions.get("City Watch")?.standing).toBe("neutral");
		expect(parsed.goals.get("Escort the Prince to Northport")?.state).toBe("Active");
		expect(parsed.quests.get("The Sunstone Conspiracy")?.state).toBe("Main");
		expect(parsed.loot.get("Ancient Silver Ring")?.active).toBe(true);
		expect(parsed.advancements[0]?.name).toBe("Kael");
		expect(parsed.ooc[0]?.label).toBe("Break");
		expect(parsed.sessionEnds[0]?.hooks[0]).toContain("shipment arrives");
	});

	test("parses dialogue, meta notes, table headers, and generator blocks structurally", () => {
		const content = `
## Interlude: One week — coast road
\`\`\`partylog
PC(Kael): "I don't trust him."
(note: Sam had to leave early)
tbl: Room Contents (d4)
  1: Empty — eerie silence
gen: Random NPC
  Role: d6=2 -> Merchant
  Trait: d6=6 -> Obsessive
\`\`\`
`;

		const parsed = PartylogParser.parse(content);

		expect(parsed.dialogue[0]?.speaker).toBe("Kael");
		expect(parsed.meta[0]?.kind).toBe("note");
		expect(parsed.tables.get("room contents")?.entries).toHaveLength(1);
		expect(parsed.generatorBlocks[0]?.title).toBe("Random NPC");
		expect(parsed.generatorBlocks[0]?.rows).toHaveLength(2);
		expect(parsed.interludes[0]?.title).toBe("One week — coast road");
	});

	test("parses narrative blocks and campaign frontmatter", () => {
		const content = `---
title: The Sunstone Conspiracy
players:
  - Alex (Kael)
  - Jordan (Sable)
---

\`\`\`partylog
\\---
Found letter text here.
---\\
\`\`\`
`;

		const parsed = PartylogParser.parse(content);

		expect(parsed.campaignHeader.title).toBe("The Sunstone Conspiracy");
		expect(parsed.campaignHeader.players).toEqual(["Alex (Kael)", "Jordan (Sable)"]);
		expect(parsed.narrativeBlocks[0]?.text).toContain("Found letter text here.");
	});

	test("captures dice semantics and mixed authority warnings", () => {
		const content = `
## Session 3
\`\`\`partylog
! The ceiling begins to crack
?(Sable) Is there another exit?
-> Yes, but...
d: 18≥15 [Adv: Flanking, -Wounded] -> S
\`\`\`
`;

		const parsed = PartylogParser.parse(content);
		const diceEntry = parsed.timeline.find((entry) => entry.type === "dice");

		expect(diceEntry?.dice?.comparison?.operator).toBe("≥");
		expect(diceEntry?.dice?.contextTags).toEqual(["Adv: Flanking", "-Wounded"]);
		expect(diceEntry?.dice?.resultCode).toBe("S");
		expect(parsed.authorityWarnings).toHaveLength(1);
	});
});
