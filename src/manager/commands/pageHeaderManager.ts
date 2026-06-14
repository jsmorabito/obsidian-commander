import { ItemView, Menu, WorkspaceLeaf } from "obsidian";
import t from "src/l10n";
import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import ChooseCustomNameModal from "src/ui/chooseCustomNameModal";
import ChooseIconModal from "src/ui/chooseIconModal";
import ConfirmDeleteModal from "src/ui/confirmDeleteModal";
import { chooseNewCommand, isModeActive } from "src/util";
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

		const buttonIcon = (view as ItemView).addAction(icon, name, () => {
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
			new Menu()
				.addItem((item) => {
					item.setTitle(t("Add command"))
						.setIcon("command")
						.onClick(async () => {
							const pair = await chooseNewCommand(this.plugin);
							this.addCommand(pair);
						});
				})
				.addSeparator()
				.addItem((item) => {
					item.setTitle(t("Change Icon"))
						.setIcon("box")
						.onClick(async () => {
							const newIcon = await new ChooseIconModal(
								this.plugin
							).awaitSelection();
							if (newIcon && newIcon !== pair.icon) {
								pair.icon = newIcon;
								await this.plugin.saveSettings();
								this.reorder();
							}
						});
				})
				.addItem((item) => {
					item.setTitle(t("Rename"))
						.setIcon("text-cursor-input")
						.onClick(async () => {
							const newName = await new ChooseCustomNameModal(
								pair.name,
								this.plugin
							).awaitSelection();
							if (newName && newName !== pair.name) {
								pair.name = newName;
								await this.plugin.saveSettings();
								this.reorder();
							}
						});
				})
				.addItem((item) => {
					item.dom.addClass("is-warning");
					item.setTitle(t("Delete"))
						.setIcon("lucide-trash")
						.onClick(async () => {
							if (
								!this.plugin.settings.confirmDeletion ||
								(await new ConfirmDeleteModal(
									this.plugin
								).didChooseRemove())
							) {
								this.removeCommand(pair);
							}
						});
				})
				.showAtMouseEvent(event);
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
			setTimeout(() => this.addButtonsToAllLeaves(), 100)
		);
	}

	private addAdderButton(leaf: WorkspaceLeaf): void {
		const { view } = leaf;
		const id = "cmdr-adder";
		if (!(view instanceof ItemView)) return;
		if (this.buttons.get(view)?.has(id)) return;
		const buttonIcon = view.addAction("plus", t("Add new"), async () => {
			this.addCommand(await chooseNewCommand(this.plugin));
		});
		buttonIcon.addClasses(["cmdr", id]);
		if (!this.buttons.has(view)) this.buttons.set(view, new Map());
		this.buttons.get(view)!.set(id, buttonIcon);
	}

	private addButtonsToAllLeaves(refresh = false): void {
		activeWindow.requestAnimationFrame(() =>
			this.plugin.app.workspace.iterateAllLeaves((leaf) =>
				this.addButtonsToLeaf(leaf, refresh)
			)
		);
	}

	private removeButtonsFromAllLeaves(): void {
		activeWindow.requestAnimationFrame(() =>
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
