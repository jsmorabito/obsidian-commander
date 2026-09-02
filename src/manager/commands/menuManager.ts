import {
	Command,
	Editor,
	MarkdownFileInfo,
	MarkdownView,
	Menu,
	MenuItem,
	setIcon,
	TAbstractFile,
	WorkspaceLeaf,
} from "obsidian";
import CommandManagerBase from "./commandManager";
import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import ConfirmDeleteModal from "src/ui/confirmDeleteModal";
import { chooseNewCommand, getCommandFromId, isModeActive } from "src/util";
import ChooseCustomNameModal from "src/ui/chooseCustomNameModal";
import ChooseIconModal from "src/ui/chooseIconModal";
import t from "src/l10n";

abstract class Base extends CommandManagerBase {
	public async addCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.push(pair);
		await this.plugin.saveSettings();
	}

	public async removeCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.remove(pair);
		await this.plugin.saveSettings();
	}

	// There is no state to update
	// eslint-disable-next-line @typescript-eslint/no-empty-function -- no state to update
	public reorder(): void {}

	protected addRemovableCommand(
		command: Command,
		cmdPair: CommandIconPair,
		plugin: CommanderPlugin,
		menu: Menu,
		commandList: CommandIconPair[]
	): (_item: MenuItem) => void {
		return (item: MenuItem) => {
			item.dom.addClass("cmdr", "cmdr-menu-item");
			item.dom.style.color =
				cmdPair.color === "#000000" || cmdPair.color === undefined
					? "inherit"
					: cmdPair.color;
			item.setSection("cmdr");

			const optionEl = createDiv({
				cls: "cmdr-menu-more-options",
			});
			let optionMenu: Menu | null = null;
			optionEl.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
				if (!optionMenu) {
					optionMenu = new Menu()
						.addItem((item) => {
							item.setTitle(t("Change Icon"))
								.setIcon("box")
								.onClick(async () => {
									const newIcon = await new ChooseIconModal(
										plugin
									).awaitSelection();
									if (newIcon && newIcon !== cmdPair.icon) {
										cmdPair.icon = newIcon;
										await plugin.saveSettings();
									}
								});
						})
						.addItem((item) => {
							item.setTitle(t("Rename"))
								.setIcon("text-cursor-input")
								.onClick(async () => {
									const newName =
										await new ChooseCustomNameModal(
											cmdPair.name,
											plugin
										).awaitSelection();
									if (newName && newName !== cmdPair.name) {
										cmdPair.name = newName;
										await plugin.saveSettings();
									}
								});
						})
						.addItem((item) => {
							item.dom.addClass("is-warning");
							item.setTitle(t("Delete"))
								.setIcon("lucide-trash")
								.onClick(async () => {
									if (
										!plugin.settings.confirmDeletion ||
										(await new ConfirmDeleteModal(
											plugin
										).didChooseRemove())
									) {
										await removeMenu();
									}
								});
						})
						.showAtMouseEvent(event);
				} else {
					optionMenu.hide();
					optionMenu = null;
				}
			});
			setIcon(optionEl, "more-vertical");
			item.dom.append(optionEl);

			item.setTitle(cmdPair.name ?? command.name)
				.setIcon(cmdPair.icon)
				.onClick(() =>
					plugin.app.commands.executeCommandById(cmdPair.id)
				);

			let isRemovable = false;
			const setNormal = (): void => {
				optionEl.removeClass("is-visible");
			};
			const setRemovable = (): void => {
				optionEl.addClass("is-visible");
			};
			const removeMenu = async (): Promise<void> => {
				item.dom.addClass("cmdr-removing");
				menu.registerDomEvent(item.dom, "transitionend", () => {
					item.dom.remove();
				});
				commandList.remove(cmdPair);
				await plugin.saveSettings();
			};

			menu.registerDomEvent(item.dom, "mousemove", (event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
				if (!isRemovable) setRemovable();
				isRemovable = true;
			});
			menu.registerDomEvent(item.dom, "mouseleave", () => {
				setNormal();
				isRemovable = false;
			});

			setNormal();
		};
	}

	protected addCommandAddButton(
		plugin: CommanderPlugin,
		menu: Menu,
		commandList: CommandIconPair[]
	): void {
		if (plugin.settings.showAddCommand) {
			menu.addItem((item: MenuItem) => {
				item.setTitle(t("Add command"))
					.setIcon("plus-circle")
					.setSection("cmdr")
					.onClick(async () => {
						try {
							const pair = await chooseNewCommand(plugin);
							commandList.push(pair);
							await plugin.saveSettings();
						} catch {
							// User cancelled command/icon selection, nothing to do
						}
					});
			});
		}
	}
}

export class EditorMenuCommandManager extends Base {
	public applyEditorMenuCommands(plugin: CommanderPlugin) {
		return async (
			menu: Menu,
			editor: Editor,
			view: MarkdownView | MarkdownFileInfo
		): Promise<void> => {
			this.addCommandAddButton(plugin, menu, plugin.settings.editorMenu);

			for (const cmdPair of plugin.settings.editorMenu) {
				const command = getCommandFromId(cmdPair.id, plugin);

				//Command has been removed
				if (!command) continue;

				if (!isModeActive(cmdPair.mode, plugin)) continue;

				//Use the check callbacks accordingly
				if (
					(command.checkCallback && !command.checkCallback(true)) ||
					(command.editorCheckCallback &&
						!command.editorCheckCallback(true, editor, view))
				)
					continue;

				menu.addItem(
					this.addRemovableCommand(
						command,
						cmdPair,
						plugin,
						menu,
						plugin.settings.editorMenu
					)
				);
			}
		};
	}
}

export class FileMenuCommandManager extends Base {
	public applyFileMenuCommands(plugin: CommanderPlugin) {
		return async (
			menu: Menu,
			_: TAbstractFile,
			__: string,
			leaf?: WorkspaceLeaf
		): Promise<void> => {
			this.addCommandAddButton(plugin, menu, plugin.settings.fileMenu);

			for (const cmdPair of plugin.settings.fileMenu) {
				const command = getCommandFromId(cmdPair.id, plugin);

				//Command has been removed
				if (!command) {
					continue;
				}

				//Check for all checkedCallbacks
				if (command.checkCallback && !command.checkCallback(true)) {
					continue;
				} else if (command.editorCallback) {
					if (!(leaf?.view instanceof MarkdownView)) {
						continue;
					}
				} else if (command.editorCheckCallback) {
					if (leaf?.view instanceof MarkdownView) {
						if (
							!command.editorCheckCallback(
								true,
								leaf.view.editor,
								leaf.view
							)
						) {
							continue;
						}
					} else {
						continue;
					}
				}

				menu.addItem(
					this.addRemovableCommand(
						command,
						cmdPair,
						plugin,
						menu,
						plugin.settings.fileMenu
					)
				);
			}
		};
	}
}
