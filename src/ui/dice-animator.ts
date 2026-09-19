/**
 * Dice Animator Component
 * Manages the 3D dice rolling overlay and animations.
 */

export class DiceAnimator {
	private overlay: HTMLElement | null = null;

	/**
	 * Shows a 3D roll animation and returns a promise that resolves when finished.
	 */
	async showRoll(total: number, sides: number = 6): Promise<void> {
		this.createOverlay();
		if (!this.overlay) return;
		const ownerWindow = this.overlay.ownerDocument.defaultView ?? window;

		const scene = this.overlay.createDiv({ cls: "lonelog-dice-scene" });
		const cube = scene.createDiv({ cls: "lonelog-cube rolling" });

		// Create faces for 3D look
		for (let i = 1; i <= 6; i++) {
			cube.createDiv({
				cls: `lonelog-cube-face face-${i}`,
				text: sides === 6 ? i.toString() : "?"
			});
		}

		// Wait for initial "tumble" animation
		await new Promise((r) => ownerWindow.setTimeout(r, 1000));

		// Set final face for d6 or just show result for others
		cube.classList.remove("rolling");

		if (sides === 6 && total >= 1 && total <= 6) {
			cube.classList.add(`show-${total}`);
		} else {
			// Non-d6 result display
			this.overlay.createDiv({
				cls: "lonelog-dice-result-text",
				text: total.toString()
			});
		}

		// Wait and cleanup
		await new Promise((r) => ownerWindow.setTimeout(r, 1500));
		this.removeOverlay();
	}

	private createOverlay(): void {
		if (this.overlay) return;
		this.overlay = window.activeDocument.body.createDiv({ cls: "lonelog-dice-overlay" });
		this.overlay.classList.add("lonelog-hidden");
		// Force reflow
		void this.overlay.offsetHeight;
		this.overlay.classList.remove("lonelog-hidden");
	}

	private removeOverlay(): void {
		if (!this.overlay) return;
		this.overlay.classList.add("lonelog-hidden");
		const ownerWindow = this.overlay.ownerDocument.defaultView ?? window;
		ownerWindow.setTimeout(() => {
			if (this.overlay) {
				this.overlay.remove();
				this.overlay = null;
			}
		}, 300);
	}
}
