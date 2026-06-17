import { tokenizeLine, tokenizeLines } from "../src/utils/lonelog-tokenizer";

describe("Tokenizer", () => {
	test("should tokenize Partylog world events", () => {
		const tokens = tokenizeLine("! The ceiling begins to crack");
		expect(tokens[0]?.type).toBe("world-event");
	});

    test("should tokenize table lines", () => {
        const tokens = tokenizeLine("tbl: d100=42 -> Result");
        expect(tokens[0]?.type).toBe("table");
        expect(tokens.some(t => t.type === "dice")).toBe(false); // dice is a subset of table line now
    });

    test("should tokenize generator lines", () => {
        const tokens = tokenizeLine("gen: UNE Motivation -> Power");
        expect(tokens[0]?.type).toBe("generator");
    });

    test("should tokenize meta notes", () => {
        const tokens = tokenizeLine("(note: testing phase 2)");
        expect(tokens[0]?.type).toBe("meta");
    });

    test("should tokenize narrative blocks", () => {
        expect(tokenizeLine("\\---")[0]?.type).toBe("narrative");
        expect(tokenizeLine("---")[0]?.type).toBe("narrative");
        expect(tokenizeLine("---\\\\")[0]?.type).toBe("narrative");
    });

    test("should tokenize dialogue", () => {
        const tokens = tokenizeLine('PC (Alex): "Hello there"');
        expect(tokens[0]?.type).toBe("dialogue");

        const npcTokens = tokenizeLine('N: "Who goes there?"');
        expect(npcTokens[0]?.type).toBe("dialogue");
    });

	test("should keep multiline PC tags highlighted across all lines", () => {
		const tokenLines = tokenizeLines([
			"[PC:Jonah",
			"| trait: friendly, curious",
			"| status: wounded",
			"| stat: HP 8, Stress 2",
			"]",
		]);

		expect(tokenLines).toHaveLength(5);
		expect(tokenLines[0]?.[0]?.type).toBe("tag");
		expect(tokenLines[1]?.[0]?.type).toBe("tag");
		expect(tokenLines[2]?.[0]?.type).toBe("tag");
		expect(tokenLines[3]?.[0]?.type).toBe("tag");
		expect(tokenLines[4]?.[0]?.type).toBe("tag");
		expect(tokenLines[4]?.[0]?.text).toBe("]");
	});

	test("should preserve existing generator and consequence highlighting", () => {
		const tokenLines = tokenizeLines([
			"gen: NPC",
			"| Name: d%=48, 29 -> Hirsham Cortina",
			"| Role: d%=6 -> Bandit",
			"| Descriptor: d%=9 -> Clever",
			"| Goal: d%=50 -> Rebel against power",
			"=> [N:Hirsham Cortina|Clever bandit|Wants to invade Highwatch]",
		]);

		expect(tokenLines[0]?.[0]?.type).toBe("generator");
		expect(tokenLines[1]?.some((token) => token.type === "result")).toBe(true);
		expect(tokenLines[5]?.[0]?.type).toBe("consequence");
		expect(tokenLines[5]?.some((token) => token.type === "tag")).toBe(true);
	});

	test("should tokenize mixed Partylog lines inside a block-like sequence", () => {
		const tokenLines = tokenizeLines([
			"@(Kael) Sneak past the guard",
			"d(Kael): Stealth d20+5=8 vs DC 14 -> Fail",
			"=> Kicks a bottle. Guard turns!",
			"! Guard draws his blade and advances",
		]);

		expect(tokenLines[0]?.[0]?.type).toBe("action");
		expect(tokenLines[1]?.[0]?.type).toBe("dice");
		expect(tokenLines[1]?.some((token) => token.type === "result")).toBe(true);
		expect(tokenLines[2]?.[0]?.type).toBe("consequence");
		expect(tokenLines[3]?.[0]?.type).toBe("world-event");
	});

	test("should highlight Partylog-specific bracket tags", () => {
		const tokenLines = tokenizeLines([
			"[Party:Gold 150|Rations 10|Wagon:intact]",
			"[Faction:City Watch|tier:2|standing:neutral]",
			"[Goal:Escort the Prince to Northport|Active]",
			"[Quest:The Sunstone Conspiracy|Main]",
			"[Loot: Ancient Silver Ring | unassigned]",
			"[Advance:Kael|Rogue 6|+Expertise]",
			"[OOC: Break | 15 mins]",
		]);

		tokenLines.forEach((line) => {
			expect(line[0]?.type).toBe("tag");
		});
	});
});
