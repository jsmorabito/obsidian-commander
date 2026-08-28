import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import CommandManagerBase from "./commandManager";
import { isModeActive } from "src/util";

export default class LeftRibbonManager extends CommandManagerBase {
	public plugin: CommanderPlugin;
	//private addBtn: HTMLDivElement;

	// Pairs that already have an unload cleanup registered. Re-injecting after a
	// layout switch must not stack another `plugin.register` callback each time.
	private readonly registered = new Set<CommandIconPair>();

	public constructor(plugin: CommanderPlugin) {
		super(plugin, plugin.settings.leftRibbon);
		this.plugin = plugin;

		this.plugin.settings.leftRibbon.forEach((pair) => {
			void this.addCommand(pair, false);
		});

		// Obsidian rebuilds the ribbon on every workspace/layout switch (the core
		// Workspaces plugin and Workspaces Plus both call `changeLayout`). When it
		// does, our imperatively-added icons are dropped. Re-assert them afterwards
		// instead of leaving the ribbon missing until the plugin is reloaded.
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("layout-change", () => this.reinject())
		);
	}

	/**
	 * Re-add any configured ribbon icons that are missing from the current ribbon,
	 * e.g. after a workspace switch tore the ribbon down and rebuilt it.
	 */
	private reinject(): void {
		for (const pair of this.plugin.settings.leftRibbon) {
			if (!isModeActive(pair.mode, this.plugin)) continue;

			const item = this.plugin.app.workspace.leftRibbon.items.find(
				(i) => i.icon === pair.icon && i.title === pair.name
			);
			if (item && item.buttonEl?.isConnected) continue;
			if (item) {
				// Stale entry left behind by a torn-down ribbon: drop it so
				// addCommand() doesn't match it and skip the rebuild.
				this.plugin.app.workspace.leftRibbon.items.remove(item);
			}
			void this.addCommand(pair, false);
		}
	}

	public async addCommand(
		pair: CommandIconPair,
		newlyAdded = true
	): Promise<void> {
		if (newlyAdded) {
			this.plugin.settings.leftRibbon.push(pair);
			await this.plugin.saveSettings();
		}
		if (isModeActive(pair.mode, this.plugin)) {
			this.plugin.addRibbonIcon(pair.icon, pair.name, () =>
				this.plugin.app.commands.executeCommandById(pair.id)
			);
			const nativeAction = this.plugin.app.workspace.leftRibbon.items.find(
				(i) => i.icon === pair.icon && i.title === pair.name
			);
			if (nativeAction) {
				nativeAction.buttonEl.style.color =
					pair.color === "#000000" || pair.color === undefined
						? "inherit"
						: pair.color;
			}
			if (!this.registered.has(pair)) {
				this.registered.add(pair);
				this.plugin.register(() => this.removeCommand(pair, false));
			}
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
		const nativeAction = this.plugin.app.workspace.leftRibbon.items.find(
			(i) => i.icon === pair.icon && i.title === pair.name
		);
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
	}
}
