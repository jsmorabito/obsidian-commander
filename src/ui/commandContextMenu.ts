import { Menu } from "obsidian";
import t from "../l10n";
import CommanderPlugin from "../main";
import CommandManagerBase from "../manager/commands/commandManager";
import { CommandIconPair } from "../types";
import { chooseNewCommand } from "../util";
import ChooseCustomNameModal from "./chooseCustomNameModal";
import ChooseIconModal from "./chooseIconModal";
import ConfirmDeleteModal from "./confirmDeleteModal";

/**
 * Right-click menu shared by the command buttons Commander adds to a UI
 * location: add a command, change icon, rename, delete.
 */
export function showCommandContextMenu(
	plugin: CommanderPlugin,
	manager: CommandManagerBase,
	pair: CommandIconPair,
	event: MouseEvent
): void {
	new Menu()
		.addItem((item) => {
			item.setTitle(t("Add command"))
				.setIcon("command")
				.onClick(async () => {
					await manager.addCommand(await chooseNewCommand(plugin));
				});
		})
		.addSeparator()
		.addItem((item) => {
			item.setTitle(t("Change Icon"))
				.setIcon("box")
				.onClick(async () => {
					const newIcon = await new ChooseIconModal(
						plugin
					).awaitSelection();
					if (newIcon && newIcon !== pair.icon) {
						pair.icon = newIcon;
						await plugin.saveSettings();
						await manager.reorder();
					}
				});
		})
		.addItem((item) => {
			item.setTitle(t("Rename"))
				.setIcon("text-cursor-input")
				.onClick(async () => {
					const newName = await new ChooseCustomNameModal(
						pair.name,
						plugin
					).awaitSelection();
					if (newName && newName !== pair.name) {
						pair.name = newName;
						await plugin.saveSettings();
						await manager.reorder();
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
						(await new ConfirmDeleteModal(plugin).didChooseRemove())
					) {
						await manager.removeCommand(pair);
					}
				});
		})
		.showAtMouseEvent(event);
}
