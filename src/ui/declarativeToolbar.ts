import {
	ExtraButtonComponent,
	Notice,
	Platform,
	setIcon,
	SliderComponent,
	SettingDefinitionItem,
	SettingDefinitionPage,
	SettingGroupItem,
} from "obsidian";
import CommanderPlugin from "../main";
import { DEFAULT_SETTINGS } from "../constants";
import { AdvancedToolbarSettings } from "../types";
import { injectIcons, updateStyles } from "../util";
import ChooseIconModal from "./chooseIconModal";
import t from "../l10n";

/**
 * SPIKE: declarative replacement for `AdvancedToolbarSettings.tsx`.
 *
 * The sliders, toggle and number inputs are native `control`s whose keys are
 * `toolbar|<field>`; the settings tab routes those to `getToolbarValue` /
 * `setToolbarValue`. Only the mobile "Custom icons" rows need `render`.
 */

const PREFIX = "toolbar|";

export const isToolbarKey = (key: string): boolean => key.startsWith(PREFIX);

type NumericField = {
	[K in keyof AdvancedToolbarSettings]: AdvancedToolbarSettings[K] extends
		| number
		| undefined
		? K
		: never;
}[keyof AdvancedToolbarSettings];

const field = (key: string): keyof AdvancedToolbarSettings =>
	key.substring(PREFIX.length) as keyof AdvancedToolbarSettings;

export function getToolbarValue(
	plugin: CommanderPlugin,
	key: string
): unknown {
	return plugin.settings.advancedToolbar[field(key)];
}

export async function setToolbarValue(
	plugin: CommanderPlugin,
	key: string,
	value: unknown
): Promise<void> {
	(plugin.settings.advancedToolbar as unknown as Record<string, unknown>)[
		field(key)
	] = value;
	await plugin.saveSettings();
	updateStyles(plugin.settings.advancedToolbar);
}

const key = (name: keyof AdvancedToolbarSettings): string => `${PREFIX}${name}`;

/**
 * A slider with a restore-default button. The declarative slider control has
 * no reset affordance, so this is a `render` row: `addSlider` plus an extra
 * button, mirroring the old `addResettableSlider`.
 */
function resettableSlider(
	plugin: CommanderPlugin,
	name: string,
	desc: string,
	fieldName: NumericField,
	min: number,
	max: number
): SettingGroupItem {
	return {
		name,
		desc,
		render: (setting): void => {
			const defaultValue = DEFAULT_SETTINGS.advancedToolbar[fieldName];
			const current = plugin.settings.advancedToolbar[fieldName];
			let slider: SliderComponent;
			let resetBtn: ExtraButtonComponent;

			setting.addSlider((cb) => {
				slider = cb;
				cb.setLimits(min, max, 1)
					.setValue(current ?? defaultValue)
					.onChange(async (value) => {
						await setToolbarValue(plugin, key(fieldName), value);
						resetBtn.setDisabled(value === defaultValue);
					});
			});
			setting.addExtraButton((bt) => {
				resetBtn = bt;
				bt.setIcon("reset")
					.setTooltip(t("Restore default"))
					.setDisabled((current ?? defaultValue) === defaultValue)
					.onClick(async () => {
						slider.setValue(defaultValue);
						await setToolbarValue(plugin, key(fieldName), defaultValue);
						resetBtn.setDisabled(true);
					});
			});
		},
	};
}

function numberInput(
	name: string,
	desc: string,
	fieldName: NumericField
): SettingGroupItem {
	return {
		name,
		desc,
		control: {
			type: "number",
			key: key(fieldName),
			placeholder: "48",
			defaultValue: 48,
			min: 0,
		},
	};
}

/** Mobile only: choose an icon for each command that has none. */
function customIconRows(
	plugin: CommanderPlugin,
	update: () => void
): SettingGroupItem[] {
	return plugin.getCommandsWithoutIcons().map((command) => ({
		name: command.name,
		desc: t("ID: {{id}}").replace("{{id}}", command.id),
		render: (setting): void => {
			setting.addButton((bt) => {
				const iconDiv = bt.buttonEl.createDiv({
					cls: "AT-settings-icon",
				});
				const mapped = plugin.settings.advancedToolbar.mappedIcons.find(
					(m) => m.commandID === command.id
				)?.iconID;
				const current = command.icon ?? mapped;
				if (current) setIcon(iconDiv, current);
				else bt.setButtonText(t("No icon"));

				bt.onClick(async () => {
					const icon = await new ChooseIconModal(
						plugin
					).awaitSelection();
					const mappedIcon =
						plugin.settings.advancedToolbar.mappedIcons.find(
							(m) => m.commandID === command.id
						);
					if (mappedIcon) mappedIcon.iconID = icon;
					else
						plugin.settings.advancedToolbar.mappedIcons.push({
							commandID: command.id,
							iconID: icon,
						});
					await plugin.saveSettings();
					injectIcons(plugin.settings.advancedToolbar, plugin);
					update();
				});
			});
			setting.addExtraButton((bt) =>
				bt
					.setIcon("reset")
					.setTooltip(t("Reset to default - requires a restart"))
					.onClick(async () => {
						plugin.settings.advancedToolbar.mappedIcons =
							plugin.settings.advancedToolbar.mappedIcons.filter(
								(p) => p.commandID !== command.id
							);
						delete command.icon;
						delete plugin.app.commands.commands[command.id].icon;
						await plugin.saveSettings();
						update();
						new Notice(
							t(
								"If the default icon doesn't appear, you might have to restart Obsidian."
							)
						);
					})
			);
		},
	}));
}

export function toolbarPage(
	plugin: CommanderPlugin,
	update: () => void
): SettingDefinitionPage {
	const items: SettingDefinitionItem[] = [
		{
			type: "group",
			heading: t("Info"),
			items: [
				Platform.isMobile
					? {
							name: t("Open mobile settings"),
							desc: t(
								"The Toolbar is only available in Obsidian Mobile. To configure which Commands show up in the Toolbar, open the Mobile Settings."
							),
							action: (): void => {
								plugin.app.setting.openTabById("interface");
							},
					  }
					: {
							name: t("Mobile only"),
							desc: t("The Toolbar is only available in Obsidian Mobile."),
					  },
			],
		},
		{
			type: "group",
			items: [
				resettableSlider(
					plugin,
					t("Toolbar row count"),
					t(
						"Set how many rows the mobile toolbar should have. Set this to 0 to remove the toolbar."
					),
					"rowCount",
					0,
					5
				),
				{
					name: t("Column layout"),
					desc: t(
						"Use a column based layout instead of the default row. This makes it easier to arrange the commands."
					),
					control: { type: "toggle", key: key("columnLayout") },
				},
				resettableSlider(
					plugin,
					t("Bottom offset"),
					t(
						"Offset the toolbar from the bottom of the screen. This is useful if the toolbar is partially obscured by other UI elements."
					),
					"heightOffset",
					0,
					32
				),
			],
		},
		{
			type: "group",
			heading: t("Custom icons"),
			visible: Platform.isMobile,
			items: customIconRows(plugin, update),
		},
		{
			type: "group",
			heading: t("Advanced settings"),
			items: [
				numberInput(
					t("Button height"),
					t(
						"Change the height of each button inside the mobile toolbar (in px)."
					),
					"rowHeight"
				),
				numberInput(
					t("Button width"),
					t(
						"Change the width of each button inside the mobile toolbar (in px)."
					),
					"buttonWidth"
				),
				resettableSlider(
					plugin,
					t("Toolbar extra spacing"),
					t(
						"Some themes need extra spacing in the toolbar. If your toolbar doesn't wrap properly, try increasing this value."
					),
					"spacing",
					0,
					64
				),
			],
		},
	];

	return {
		type: "page",
		name: Platform.isMobile ? t("Mobile Toolbar") : t("Toolbar"),
		desc: t("Mobile toolbar layout and icons"),
		items,
	};
}
