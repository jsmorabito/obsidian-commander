import { Platform, WorkspaceRibbon, setTooltip } from "obsidian";
import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import CommandManagerBase from "./commandManager";
import { isModeActive } from "src/util";

/**
 * Obsidian still builds `workspace.rightRibbon` and mounts it on the right edge
 * of the workspace on desktop; it is only hidden by CSS and never given an
 * items container. Rather than drawing our own strip, we give the native ribbon
 * its container back and add buttons through its own `addRibbonItemButton`, so
 * markup, styling, collapse state and drag behaviour all come from core.
 */
export default class RightRibbonManager extends CommandManagerBase {
	public plugin: CommanderPlugin;
	private ownsItemsEl = false;

	public constructor(plugin: CommanderPlugin) {
		super(plugin, plugin.settings.rightRibbon);
		this.plugin = plugin;

		// Mobile has no right ribbon in the DOM (the left one becomes the
		// drawer ribbon), so there is nothing to attach to.
		if (Platform.isMobile || !this.ribbon) return;

		this.plugin.settings.rightRibbon.forEach((pair) => {
			void this.addCommand(pair, false);
		});

		// Core's drag-to-reorder updates `items` and then calls
		// `onChange(true)`, which saves the layout, but core only saves the left
		// ribbon's order. Hook this one instance so a drag also updates our
		// settings; deleting the own property on unload restores the prototype
		// method.
		const ribbon = this.ribbon;
		const onChange = ribbon.onChange;
		ribbon.onChange = (persist: boolean): void => {
			onChange.call(ribbon, persist);
			if (persist) void this.syncOrderFromRibbon();
		};
		this.plugin.register(() => {
			Reflect.deleteProperty(ribbon, "onChange");
		});

		this.plugin.register(() => {
			this.plugin.settings.rightRibbon.forEach((pair) => {
				void this.removeCommand(pair, false);
			});
			const ribbon = this.ribbon;
			if (!ribbon) return;
			ribbon.containerEl.removeClass("cmdr-right-ribbon");
			if (this.ownsItemsEl) {
				ribbon.ribbonItemsEl?.remove();
				ribbon.ribbonItemsEl = null;
			}
		});
	}

	private get ribbon(): WorkspaceRibbon | undefined {
		// Deprecated in the typings, but core still creates and mounts it.
		return this.plugin.app.workspace.rightRibbon;
	}

	private get idPrefix(): string {
		return `${this.plugin.manifest.id}:right:`;
	}

	// Key on icon and name too, like the left ribbon, so two entries for the
	// same command with different names or icons get their own buttons.
	private itemId(pair: CommandIconPair): string {
		return `${this.idPrefix}${pair.id}:${pair.icon}:${pair.name}`;
	}

	private findItem(
		pair: CommandIconPair
	): WorkspaceRibbon["items"][number] | undefined {
		const id = this.itemId(pair);
		return this.ribbon?.items.find((i) => i.id === id);
	}

	/**
	 * Copy the ribbon's button order back into settings after a drag. Entries
	 * with no button (another device's mode) keep their slots; the shown ones
	 * fill their slots in the ribbon's new order.
	 */
	private async syncOrderFromRibbon(): Promise<void> {
		const ribbon = this.ribbon;
		if (!ribbon) return;
		const shown = (pair: CommandIconPair): boolean =>
			!!this.findItem(pair)?.buttonEl;
		const ordered = ribbon.items
			.map((item) => this.pairs.find((p) => this.itemId(p) === item.id))
			.filter((p): p is CommandIconPair => !!p);
		// Identical entries share one button, so slots and buttons can't be
		// matched up; leave the order alone.
		if (ordered.length !== this.pairs.filter(shown).length) return;

		let next = 0;
		const reordered = this.pairs.map((p) => (shown(p) ? ordered[next++] : p));
		if (reordered.every((p, i) => p === this.pairs[i])) return;
		// Reorder in place: `pairs` is the settings array itself.
		this.pairs.splice(0, this.pairs.length, ...reordered);
		await this.plugin.saveSettings();
	}

	/** Lazily give the native right ribbon the container it lacks. */
	private ensureItemsEl(): void {
		const ribbon = this.ribbon;
		if (!ribbon || ribbon.ribbonItemsEl) return;
		ribbon.ribbonItemsEl = ribbon.containerEl.createDiv("side-dock-actions");
		this.ownsItemsEl = true;
	}

	/**
	 * Only reveal the ribbon while it actually has buttons in it. Don't test
	 * `isConnected`: on startup the plugin loads before Obsidian attaches the
	 * ribbon to the DOM.
	 */
	private updateVisibility(): void {
		const ribbon = this.ribbon;
		if (!ribbon) return;
		const visible = this.plugin.settings.rightRibbon.some(
			(pair) => !!this.findItem(pair)?.buttonEl
		);
		ribbon.containerEl.toggleClass("cmdr-right-ribbon", visible);
	}

	public async addCommand(
		pair: CommandIconPair,
		newlyAdded = true
	): Promise<void> {
		if (newlyAdded) {
			this.plugin.settings.rightRibbon.push(pair);
			await this.plugin.saveSettings();
		}
		const ribbon = this.ribbon;
		if (Platform.isMobile || !ribbon) return;
		if (!isModeActive(pair.mode, this.plugin)) return;

		this.ensureItemsEl();
		if (!this.findItem(pair)?.buttonEl) {
			const buttonEl = ribbon.addRibbonItemButton(
				this.itemId(pair),
				pair.icon,
				pair.name,
				() => this.plugin.app.commands.executeCommandById(pair.id)
			);
			// Core places ribbon tooltips to the right, which is off-screen here.
			setTooltip(buttonEl, pair.name, { placement: "left" });
		}

		const nativeAction = this.findItem(pair);
		if (nativeAction?.buttonEl) {
			nativeAction.buttonEl.style.color =
				pair.color === "#000000" || pair.color === undefined
					? "inherit"
					: pair.color;
		}
		this.updateVisibility();
	}

	public async removeCommand(
		pair: CommandIconPair,
		remove = true
	): Promise<void> {
		if (remove) {
			this.plugin.settings.rightRibbon.remove(pair);
			await this.plugin.saveSettings();
		}
		const nativeAction = this.findItem(pair);
		if (nativeAction) {
			nativeAction.buttonEl?.remove();
			this.ribbon?.items.remove(nativeAction);
		}
		this.updateVisibility();
	}

	public reorder(): void {
		// Edits mutate a pair (name, icon) before calling this, so its old
		// button can no longer be found by key. Clear every button we own, then
		// rebuild in settings order; the native ribbon renders `items` in array
		// order.
		const ribbon = this.ribbon;
		if (ribbon) {
			for (const item of ribbon.items.filter((i) =>
				i.id?.startsWith(this.idPrefix)
			)) {
				item.buttonEl?.remove();
				ribbon.items.remove(item);
			}
		}
		this.plugin.settings.rightRibbon.forEach((pair) => {
			void this.addCommand(pair, false);
		});
		this.updateVisibility();
	}
}
