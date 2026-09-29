import { SettingDefinitionPage } from "obsidian";
import CommanderPlugin from "../main";
import { Macro } from "../types";
import { updateMacroCommands } from "../util";
import MacroBuilderModal from "./components/MacroBuilderModal";
import ConfirmDeleteModal from "./confirmDeleteModal";

/**
 * SPIKE: declarative replacement for `MacroViewer.tsx`. Only the list is
 * declarative; the builder stays the existing `MacroBuilderModal`.
 */
export function macrosPage(
	plugin: CommanderPlugin,
	update: () => void
): SettingDefinitionPage {
	const macros = plugin.settings.macros;

	const openBuilder = (macro: Macro, idx?: number): void => {
		const modal = new MacroBuilderModal(plugin, macro, (updated) => {
			macros.splice(
				idx !== undefined ? idx : macros.length,
				idx !== undefined ? 1 : 0,
				updated
			);
			void plugin.saveSettings();
			updateMacroCommands(plugin);
			modal.close();
			update();
		});
		modal.open();
	};

	return {
		type: "page",
		name: "Macros",
		desc: "Sequences of commands you can run as one",
		items: [
			{
				type: "list",
				heading: "Macros",
				emptyState: "No Macros yet! Add one with the + button.",
				items: macros.map((macro, idx) => ({
					name: macro.name,
					desc: `${macro.macro.length} Actions`,
					render: (setting): void => {
						setting.addExtraButton((btn) =>
							btn
								.setIcon("lucide-pencil")
								.setTooltip("Edit Macro")
								.onClick(() => openBuilder(macro, idx))
						);
					},
				})),
				onDelete: (index): void => {
					void (async (): Promise<void> => {
						if (
							plugin.settings.confirmDeletion &&
							!(await new ConfirmDeleteModal(
								plugin
							).didChooseRemove())
						) {
							update();
							return;
						}
						macros.splice(index, 1);
						await plugin.saveSettings();
						updateMacroCommands(plugin);
						update();
					})();
				},
				addItem: {
					name: "Add Macro",
					action: (): void =>
						openBuilder({ name: "", macro: [], icon: "star" }),
				},
			},
		],
	};
}
