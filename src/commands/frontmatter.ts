import { App, TFile, Notice } from "obsidian";
import { LonelogSettings } from "../settings";

export interface LonelogFrontmatter {
    title?: string;
    ruleset?: string;
    genre?: string;
    player?: string;
    pcs?: string;
    start_date?: string;
    last_update?: string;
    tools?: string;
    themes?: string;
    tone?: string;
    notes?: string;
    [key: string]: string | number | boolean | undefined | string[]; 
}

export class FrontmatterCommands {
    /**
     * Injects the default Lonelog properties into the active file's frontmatter.
     */
    static async initializeNote(app: App, file: TFile, settings: LonelogSettings): Promise<void> {
        try {
            const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

            await app.fileManager.processFrontMatter(file, (frontmatter: LonelogFrontmatter) => {
                // We don't overwrite existing values if they are already set
                if (frontmatter.title === undefined) frontmatter.title = file.basename;
                if (frontmatter.ruleset === undefined) frontmatter.ruleset = settings.defaultRuleset;
                if (frontmatter.genre === undefined) frontmatter.genre = settings.defaultGenre;
                if (frontmatter.player === undefined) frontmatter.player = settings.defaultPlayer;
                if (frontmatter.pcs === undefined) {
                    frontmatter.pcs = `${settings.defaultPlayer} [PC:${settings.defaultPlayer}|HP 10|Stress 0|Gear:...]`;
                }
                if (frontmatter.start_date === undefined) frontmatter.start_date = today;

                // Always update last_update when initializing
                frontmatter.last_update = today;

                if (frontmatter.tools === undefined) frontmatter.tools = "Oracles - Mythic, Random Event tables";
                if (frontmatter.themes === undefined) frontmatter.themes = settings.defaultThemes;
                if (frontmatter.tone === undefined) frontmatter.tone = settings.defaultTone;
                if (frontmatter.notes === undefined) frontmatter.notes = "";
            });

            new Notice("Properties initialized");
        } catch (error) {
            console.error("Error initializing Lonelog properties:", error);
            new Notice("Failed to initialize properties");
        }
    }
}
