import { tokenizeLine } from "../src/utils/lonelog-tokenizer";

describe("Tokenizer", () => {
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
});
