import { SettingDefinitionList, SettingDefinitionRender } from "obsidian";
import CommanderPlugin from "../main";
import CommandManagerBase from "../manager/commands/commandManager";
import { CommandIconPair } from "../types";
import { chooseNewCommand, getCommandFromId, isModeActive } from "../util";
import ChooseIconModal from "./chooseIconModal";
import ConfirmDeleteModal from "./confirmDeleteModal";

/**
 * SPIKE: shared declarative replacement for `CommandViewer`. Given any
 * `CommandManagerBase`, builds a `list` definition with add, delete, drag
 * reorder and per-row rename / icon / color / mode controls.
 */

const MODE_ICONS: Record<string, string> = {
	mobile: "smartphone",
	desktop: "monitor",
	any: "cmdr-all-devices",
};

function modeLabel(mode: string): string {
	return /desktop|mobile|any/.test(mode)
		? mode[0].toUpperCase() + mode.substring(1)
		: "This device";
}

export function commandListDefinition(
	plugin: CommanderPlugin,
	manager: CommandManagerBase,
	heading: string,
	update: () => void
): SettingDefinitionList {
	// Persist + re-apply to the real UI location (ribbon, status bar, ...).
	const apply = async (rerender: boolean): Promise<void> => {
		await plugin.saveSettings();
		await manager.reorder();
		if (rerender) update();
	};

	const row = (pair: CommandIconPair): SettingDefinitionRender => {
		const cmd = getCommandFromId(pair.id, plugin);
		const owner = plugin.app.plugins.manifests[cmd?.id.split(":")[0] ?? ""];

		return {
			// The row title is the underlying command; the editable name is the input.
			name: cmd?.name ?? pair.name,
			desc: cmd
				? `Added by ${owner?.name ?? "Obsidian"}.`
				: "This Command is not available on this device.",
			render: (setting): void => {
				if (!cmd) {
					setting.setClass("mod-warning");
					return;
				}
				// Rows that don't apply to this device stay visible but dimmed,
				// so the list index always matches the underlying array.
				setting.settingEl.toggleClass(
					"cmdr-mode-inactive",
					!isModeActive(pair.mode, plugin)
				);

				// Rename: commit on blur / Enter, not on every keystroke.
				setting.addText((text) => {
					text.setValue(pair.name).setPlaceholder(cmd.name);
					text.inputEl.addEventListener("keydown", (e) => {
						if (e.key === "Enter") text.inputEl.blur();
					});
					text.inputEl.addEventListener("blur", () => {
						const next = text.getValue().trim() || cmd.name;
						if (next === pair.name) return;
						pair.name = next;
						void apply(true);
					});
				});

				setting.addExtraButton((btn) =>
					btn
						.setIcon(pair.icon)
						.setTooltip("Choose new icon")
						.onClick(async () => {
							const icon = await new ChooseIconModal(
								plugin
							).awaitSelection();
							if (icon && icon !== pair.icon) {
								pair.icon = icon;
								await apply(true);
							}
						})
				);

				setting.addColorPicker((picker) =>
					picker
						.setValue(pair.color ?? "#000000")
						.onChange(async (value) => {
							pair.color = value;
							await apply(false);
						})
				);

				// Mode: cycles any -> desktop -> mobile -> this device
				setting.addExtraButton((btn) =>
					btn
						.setIcon(MODE_ICONS[pair.mode] ?? "airplay")
						.setTooltip(
							`Mode: ${modeLabel(pair.mode)} (click to change)`
						)
						.onClick(async () => {
							const modes = [
								"any",
								"desktop",
								"mobile",
								plugin.app.appId,
							];
							const idx = modes.indexOf(pair.mode);
							pair.mode = modes[(idx + 1) % modes.length];
							await apply(true);
						})
				);
			},
		};
	};

	return {
		type: "list",
		heading,
		emptyState: "No commands added yet.",
		items: manager.pairs.map(row),
		onDelete: (index): void => {
			void (async (): Promise<void> => {
				if (
					plugin.settings.confirmDeletion &&
					!(await new ConfirmDeleteModal(plugin).didChooseRemove())
				) {
					// Cancelled: re-render so the row comes back.
					update();
					return;
				}
				await manager.removeCommand(manager.pairs[index]);
				update();
			})();
		},
		onReorder: (from, to): void => {
			const [moved] = manager.pairs.splice(from, 1);
			manager.pairs.splice(to, 0, moved);
			void apply(false);
		},
		addItem: {
			name: "Add command",
			action: (): void => {
				void (async (): Promise<void> => {
					const pair = await chooseNewCommand(plugin);
					await manager.addCommand(pair);
					await manager.reorder();
					update();
				})();
			},
		},
	};
}
