/**
 * Scene Navigator Panel
 * Displays an outline of all sessions and scenes for easy navigation
 */

import { Campaign } from "../utils/campaign";
import { LonelogView } from "./lonelog-view";
import { NotationParser, ParsedSession, ParsedScene } from "../utils/parser";

export const SCENE_NAV_TYPE = "lonelog-scene-nav";

export class SceneNavigatorView extends LonelogView {
	private sessions: ParsedSession[] = [];

	protected readonly containerClasses = ["lonelog-scene-container"];

	getViewType(): string {
		return SCENE_NAV_TYPE;
	}

	getDisplayText(): string {
		return "Lonelog scenes";
	}

	getIcon(): string {
		return "map";
	}

	protected renderCampaign(container: HTMLElement, campaign: Campaign): void {
		const parsed = NotationParser.parse(campaign.content);
		this.sessions = parsed.sessions;

		// Render header
		const header = container.createDiv({
			cls: "lonelog-scene-header",
		});
		header.createEl("h4", { text: "Scene navigator" });

		const totalScenes = this.sessions.reduce(
			(sum, session) => sum + session.scenes.length,
			0
		);
		header.createSpan({
			text: `${this.sessions.length} sessions, ${totalScenes} scenes`,
			cls: "lonelog-count",
		});

		// Check if empty
		if (this.sessions.length === 0) {
			container.createDiv({
				text: "No sessions found. Use 'insert session header' to create one.",
				cls: "lonelog-empty-state",
			});
			return;
		}

		// Render sessions
		this.sessions.forEach((session) => {
			this.renderSession(container, session);
		});
	}

	private renderSession(container: HTMLElement, session: ParsedSession): void {
		const sessionEl = container.createDiv({
			cls: "lonelog-scene-session",
		});

		// Session header (clickable)
		const sessionHeader = sessionEl.createDiv({
			cls: "lonelog-scene-session-header",
		});

		const sessionBtn = sessionHeader.createEl("button", {
			cls: "lonelog-scene-session-btn",
		});

		const sessionTitle = sessionBtn.createSpan({
			cls: "lonelog-scene-session-title",
		});
		sessionTitle.createEl("strong", { text: `Session ${session.number}` });

		if (session.date) {
			sessionTitle.createSpan({
				text: ` • ${session.date}`,
				cls: "lonelog-scene-date",
			});
		}

		sessionBtn.addEventListener("click", () => {
			this.jumpToLine(session.line);
		});

		// Scene count
		sessionHeader.createSpan({
			text: `${session.scenes.length} scenes`,
			cls: "lonelog-scene-count",
		});

		// Scenes list
		if (session.scenes.length > 0) {
			const scenesList = sessionEl.createDiv({
				cls: "lonelog-scene-list",
			});

			session.scenes.forEach((scene) => {
				this.renderScene(scenesList, scene);
			});
		} else {
			sessionEl.createDiv({
				text: "No scenes yet",
				cls: "lonelog-scene-empty",
			});
		}
	}

	private renderScene(container: HTMLElement, scene: ParsedScene): void {
		const sceneEl = container.createDiv({
			cls: "lonelog-scene-item",
		});

		const sceneBtn = sceneEl.createEl("button", {
			cls: "lonelog-scene-btn",
		});

		sceneBtn.createSpan({
			text: scene.number,
			cls: "lonelog-scene-number",
		});

		sceneBtn.createSpan({
			text: scene.context,
			cls: "lonelog-scene-context",
		});

		sceneBtn.addEventListener("click", () => {
			this.jumpToLine(scene.line);
		});
	}

	async onClose(): Promise<void> {
		// Cleanup
	}
}
