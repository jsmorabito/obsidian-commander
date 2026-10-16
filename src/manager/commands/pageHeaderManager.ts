import { ItemView, WorkspaceLeaf } from "obsidian";
import t from "src/l10n";
import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import { chooseNewCommand, isModeActive } from "src/util";
import { showCommandContextMenu } from "src/ui/commandContextMenu";
import CommandManagerBase from "./commandManager";

export default class PageHeaderManager extends CommandManagerBase {
	public buttons = new WeakMap<ItemView, Map<string, HTMLElement>>();

	public constructor(plugin: CommanderPlugin, pairArray: CommandIconPair[]) {
		super(plugin, pairArray);
		this.init();
	}

	private addPageHeaderButton(
		leaf: WorkspaceLeaf,
		pair: CommandIconPair
	): void {
		const { id, icon, name } = pair;
		const { view } = leaf;
		if (!(view instanceof ItemView)) return;
		const buttons = this.buttonsFor(leaf, true);
		if (!buttons || buttons.has(id)) return;

		const buttonIcon = view.addAction(icon, name, () => {
			this.plugin.app.workspace.setActiveLeaf(leaf, { focus: true });
			this.plugin.app.commands.executeCommandById(id);
		});
		buttons.set(id, buttonIcon);

		buttonIcon.addClasses(["cmdr-page-header", id]);
		buttonIcon.style.color =
			pair.color === "#000000" || pair.color === undefined
				? "inherit"
				: pair.color;
		buttonIcon.addEventListener("contextmenu", (event) => {
			event.stopImmediatePropagation();
			showCommandContextMenu(this.plugin, this, pair, event);
		});
	}

	private init(): void {
		this.plugin.register(() => {
			// Remove all buttons on plugin unload
			this.removeButtonsFromAllLeaves();
		});
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("layout-change", () => {
				this.addButtonsToAllLeaves();
			})
		);
		this.plugin.app.workspace.onLayoutReady(() =>
			window.setTimeout(() => this.addButtonsToAllLeaves(), 100)
		);
	}

	private addAdderButton(leaf: WorkspaceLeaf): void {
		const { view } = leaf;
		const id = "cmdr-adder";
		if (!(view instanceof ItemView)) return;
		if (this.buttons.get(view)?.has(id)) return;
		const buttonIcon = view.addAction("plus", t("Add new"), async () => {
			await this.addCommand(await chooseNewCommand(this.plugin));
		});
		buttonIcon.addClasses(["cmdr", id]);
		if (!this.buttons.has(view)) this.buttons.set(view, new Map());
		this.buttons.get(view)!.set(id, buttonIcon);
	}

	private addButtonsToAllLeaves(refresh = false): void {
		window.requestAnimationFrame(() =>
			this.plugin.app.workspace.iterateAllLeaves((leaf) =>
				this.addButtonsToLeaf(leaf, refresh)
			)
		);
	}

	private removeButtonsFromAllLeaves(): void {
		window.requestAnimationFrame(() =>
			this.plugin.app.workspace.iterateAllLeaves((leaf) =>
				this.removeButtonsFromLeaf(leaf)
			)
		);
	}

	private buttonsFor(leaf: WorkspaceLeaf, create = false): Map<string, HTMLElement> | undefined {
		if (!(leaf.view instanceof ItemView)) return;
		if (create && !this.buttons.has(leaf.view))
			this.buttons.set(leaf.view, new Map());
		return this.buttons.get(leaf.view);
	}

	private addButtonsToLeaf(leaf: WorkspaceLeaf, refresh = false): void {
		if (!(leaf.view instanceof ItemView)) return;
		if (refresh) {
			this.removeButtonsFromLeaf(leaf);
		} else if (this.buttonsFor(leaf)?.size) {
			// View already has buttons and we're not doing a full refresh
			return;
		}
		for (let i = this.pairs.length - 1; i >= 0; i--) {
			const pair = this.pairs[i];
			if (isModeActive(pair.mode, this.plugin))
				this.addPageHeaderButton(leaf, pair);
		}
		if (this.plugin.settings.showAddCommand) this.addAdderButton(leaf);
	}

	private removeButtonsFromLeaf(leaf: WorkspaceLeaf): void {
		const buttons = this.buttonsFor(leaf);
		if (buttons) {
			for (const button of buttons.values()) button.detach();
			buttons?.clear();
		}
	}

	public reorder(): void | Promise<void> {
		this.addButtonsToAllLeaves(true);
	}

	public async addCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.push(pair);
		this.addButtonsToAllLeaves(true);
		await this.plugin.saveSettings();
	}

	public async removeCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.remove(pair);
		this.addButtonsToAllLeaves(true);
		await this.plugin.saveSettings();
	}
}
