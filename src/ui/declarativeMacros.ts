import { SettingDefinitionPage } from "obsidian";
import CommanderPlugin from "../main";
import { Macro } from "../types";
import { updateMacroCommands } from "../util";
import MacroBuilderModal from "./components/MacroBuilderModal";
import ConfirmDeleteModal from "./confirmDeleteModal";
import t from "../l10n";

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
		name: t("Macros"),
		desc: t("Sequences of commands you can run as one"),
		items: [
			{
				type: "list",
				heading: t("Macros"),
				emptyState: `${t("No Macros yet!")} ${t(
					"Would you like to add one now?"
				)}`,
				items: macros.map((macro, idx) => ({
					name: macro.name,
					desc: t("{{count}} Actions").replace(
						"{{count}}",
						String(macro.macro.length)
					),
					render: (setting): void => {
						setting.addExtraButton((btn) =>
							btn
								.setIcon("lucide-pencil")
								.setTooltip(t("Edit Macro"))
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
					name: t("Add Macro"),
					action: (): void =>
						openBuilder({ name: "", macro: [], icon: "star" }),
				},
			},
		],
	};
}
