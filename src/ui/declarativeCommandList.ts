import {
	Platform,
	SettingDefinitionList,
	SettingDefinitionRender,
} from "obsidian";
import CommanderPlugin from "../main";
import CommandManagerBase from "../manager/commands/commandManager";
import { CommandIconPair } from "../types";
import { chooseNewCommand, getCommandFromId, isModeActive } from "../util";
import ChooseIconModal from "./chooseIconModal";
import ConfirmDeleteModal from "./confirmDeleteModal";
import MobileModifyModal from "./mobileModifyModal";
import t from "../l10n";

/**
 * Declarative command list for any `CommandManagerBase`: add, delete, drag
 * reorder and per-row edit controls (a single edit button on mobile).
 */

const MODE_ICONS: Record<string, string> = {
	mobile: "smartphone",
	desktop: "monitor",
	any: "cmdr-all-devices",
};

function modeLabel(mode: string): string {
	return /desktop|mobile|any/.test(mode)
		? mode[0].toUpperCase() + mode.substring(1)
		: t("This device");
}

export interface CommandListOptions {
	/** Show the per-row desktop/mobile mode control (default true). */
	showMode?: boolean;
	/** Show the per-row color picker (default true). */
	showColor?: boolean;
}

export function commandListDefinition(
	plugin: CommanderPlugin,
	manager: CommandManagerBase,
	heading: string,
	update: () => void,
	options: CommandListOptions = {}
): SettingDefinitionList {
	const showMode = options.showMode ?? true;
	const showColor = options.showColor ?? true;
	// Persist + re-apply to the real UI location (ribbon, status bar, ...).
	const apply = async (rerender: boolean): Promise<void> => {
		await plugin.saveSettings();
		await manager.reorder();
		if (rerender) update();
	};

	const modes = ["any", "desktop", "mobile", plugin.app.appId];

	const row = (pair: CommandIconPair): SettingDefinitionRender => {
		const cmd = getCommandFromId(pair.id, plugin);
		const owner = plugin.app.plugins.manifests[cmd?.id.split(":")[0] ?? ""];
		const addedBy = t("Added by {{plugin_name}}.").replace(
			"{{plugin_name}}",
			owner?.name ?? "Obsidian"
		);

		// Shared by the inline controls and the mobile modal. The desktop input
		// passes rerender=false: re-rendering on blur would swallow the click
		// that caused it.
		const rename = (name: string, rerender = true): void => {
			pair.name = name.trim() || cmd?.name || pair.name;
			void apply(rerender);
		};
		const chooseIcon = async (): Promise<void> => {
			const icon = await new ChooseIconModal(plugin).awaitSelection();
			if (icon && icon !== pair.icon) {
				pair.icon = icon;
				await apply(true);
			}
			// MobileModifyComponent re-renders its icon only on this event.
			dispatchEvent(new Event("cmdr-icon-changed"));
		};
		// With no argument, cycles any -> desktop -> mobile -> this device.
		const changeMode = (mode?: string): void => {
			pair.mode =
				mode || modes[(modes.indexOf(pair.mode) + 1) % modes.length];
			void apply(true);
		};
		const changeColor = (color?: string): void => {
			pair.color = color;
			void apply(false);
		};

		return {
			// Mobile has no inline name input, so it shows the custom name as the
			// title and moves the command name into the description.
			name: Platform.isMobile ? pair.name : cmd?.name ?? pair.name,
			desc: cmd
				? Platform.isMobile && pair.name !== cmd.name
					? `${cmd.name} · ${addedBy}`
					: addedBy
				: t("This Command is not available on this device."),
			render: (setting): void => {
				if (!cmd) {
					setting.setClass("mod-warning");
					return;
				}
				// Dim (don't hide) rows for other devices so list indices match pairs.
				setting.settingEl.toggleClass(
					"cmdr-mode-inactive",
					showMode && !isModeActive(pair.mode, plugin)
				);

				// Mobile: a single edit button opens the existing modal.
				if (Platform.isMobile) {
					setting.addExtraButton((btn) =>
						btn
							.setIcon("lucide-pencil")
							.setTooltip(t("Edit"))
							.onClick(() =>
								new MobileModifyModal(
									plugin,
									pair,
									rename,
									() => void chooseIcon(),
									changeMode,
									changeColor
								).open()
							)
					);
					return;
				}

				// Rename: commit on blur / Enter, not on every keystroke.
				setting.addText((text) => {
					text.setValue(pair.name).setPlaceholder(cmd.name);
					text.inputEl.addEventListener("keydown", (e) => {
						if (e.key === "Enter") text.inputEl.blur();
					});
					text.inputEl.addEventListener("blur", () => {
						if (text.getValue().trim() !== pair.name) {
							rename(text.getValue(), false);
						}
					});
				});

				setting.addExtraButton((btn) =>
					btn
						.setIcon(pair.icon)
						.setTooltip(t("Choose new"))
						.onClick(() => void chooseIcon())
				);

				if (showColor) {
					setting.addColorPicker((picker) =>
						picker
							.setValue(pair.color ?? "#000000")
							.onChange((value) => changeColor(value))
					);
				}

				if (!showMode) return;

				setting.addExtraButton((btn) =>
					btn
						.setIcon(MODE_ICONS[pair.mode] ?? "airplay")
						.setTooltip(
							t("Change Mode (Currently: {{current_mode}})").replace(
								"{{current_mode}}",
								modeLabel(pair.mode)
							)
						)
						.onClick(() => changeMode())
				);
			},
		};
	};

	return {
		type: "list",
		heading,
		emptyState: `${t("No commands here!")} ${t(
			"Would you like to add one now?"
		)}`,
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
			name: t("Add command"),
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
