import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import CommandManagerBase from "./commandManager";
import { isModeActive } from "src/util";

export default class LeftRibbonManager extends CommandManagerBase {
	public plugin: CommanderPlugin;
	//private addBtn: HTMLDivElement;

	public constructor(plugin: CommanderPlugin) {
		super(plugin, plugin.settings.leftRibbon);
		this.plugin = plugin;

		this.plugin.settings.leftRibbon.forEach((pair) => {
			void this.addCommand(pair, false);
		});

		// Remove every icon we added when the plugin unloads. One bulk cleanup,
		// matching statusBarManager / explorerManager, rather than tracking each
		// pair's registration separately.
		this.plugin.register(() =>
			this.plugin.settings.leftRibbon.forEach((pair) => {
				void this.removeCommand(pair, false);
			})
		);

		// Obsidian rebuilds the ribbon on every workspace/layout switch (the core
		// Workspaces plugin and Workspaces Plus both call `changeLayout`), which
		// drops our imperatively-added icons. Re-add any that went missing instead
		// of leaving the ribbon broken until the plugin reloads.
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("layout-change", () => this.reinject())
		);
	}

	private findItem(
		pair: CommandIconPair
	): { icon: string; title: string; buttonEl: HTMLElement } | undefined {
		return this.plugin.app.workspace.leftRibbon.items.find(
			(i) => i.icon === pair.icon && i.title === pair.name
		);
	}

	/**
	 * Re-add any configured ribbon icons whose button is no longer in the DOM,
	 * e.g. after a workspace switch tore the ribbon down and rebuilt it. No-ops
	 * (and touches no DOM) when every icon is already present, which is the
	 * common case for the frequently-fired `layout-change` event.
	 */
	private reinject(): void {
		let injected = false;
		for (const pair of this.plugin.settings.leftRibbon) {
			if (!isModeActive(pair.mode, this.plugin)) continue;

			const item = this.findItem(pair);
			if (item?.buttonEl?.isConnected) continue;
			if (item) {
				// Stale entry left behind by a torn-down ribbon: drop it so
				// addCommand() rebuilds the button instead of matching it.
				this.plugin.app.workspace.leftRibbon.items.remove(item);
			}
			void this.addCommand(pair, false);
			injected = true;
		}
		if (injected) this.applyOrder();
	}

	/**
	 * Put our ribbon buttons back into the order the user configured them in, but
	 * only when they are actually out of order — never move them otherwise. Where
	 * the group sits relative to non-Commander items stays governed by Obsidian's
	 * own saved ribbon order.
	 */
	private applyOrder(): void {
		const container = this.plugin.app.workspace.leftRibbon.ribbonItemsEl;
		if (!container) return;

		const desired: HTMLElement[] = [];
		for (const pair of this.plugin.settings.leftRibbon) {
			const el = this.findItem(pair)?.buttonEl;
			if (el?.isConnected) desired.push(el);
		}
		if (desired.length < 2) return;

		const current = Array.from(container.children).filter((c) =>
			desired.includes(c as HTMLElement)
		);
		if (current.every((c, i) => c === desired[i])) return;

		for (const el of desired) container.appendChild(el);
	}

	public async addCommand(
		pair: CommandIconPair,
		newlyAdded = true
	): Promise<void> {
		if (newlyAdded) {
			this.plugin.settings.leftRibbon.push(pair);
			await this.plugin.saveSettings();
		}
		if (!isModeActive(pair.mode, this.plugin)) return;

		// Don't stack a second button if one is already live (e.g. Obsidian
		// re-created it on rebuild before our layout-change handler ran).
		if (!this.findItem(pair)?.buttonEl?.isConnected) {
			this.plugin.addRibbonIcon(pair.icon, pair.name, () =>
				this.plugin.app.commands.executeCommandById(pair.id)
			);
		}

		const nativeAction = this.findItem(pair);
		if (nativeAction) {
			nativeAction.buttonEl.style.color =
				pair.color === "#000000" || pair.color === undefined
					? "inherit"
					: pair.color;
		}
	}

	public async removeCommand(
		pair: CommandIconPair,
		remove = true
	): Promise<void> {
		if (remove) {
			this.plugin.settings.leftRibbon.remove(pair);
			await this.plugin.saveSettings();
		}
		const nativeAction = this.findItem(pair);
		if (nativeAction) {
			nativeAction.buttonEl.remove();
			this.plugin.app.workspace.leftRibbon.items.remove(nativeAction);
		}
	}

	public reorder(): void {
		this.plugin.settings.leftRibbon.forEach((pair) => {
			void this.removeCommand(pair, false);
			void this.addCommand(pair, false);
		});
		this.applyOrder();
	}
}
