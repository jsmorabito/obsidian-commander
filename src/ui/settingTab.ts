import {
	PluginSettingTab,
	SettingDefinitionItem,
	SettingGroupItem,
} from "obsidian";
import { h, render } from "preact";
import CommanderPlugin from "../main";
import CommandManagerBase from "../manager/commands/commandManager";
import About from "./components/About";
import { updateSpacing } from "../util";
import t from "../l10n";
import TextToolbarIntegrationManager from "../manager/commands/textToolbarIntegrationManager";
import {
	CommandListOptions,
	commandListDefinition,
} from "./declarativeCommandList";
import { macrosPage } from "./declarativeMacros";
import {
	getToolbarValue,
	isToolbarKey,
	setToolbarValue,
	toolbarPage,
} from "./declarativeToolbar";
import {
	isHideKey,
	isShown,
	menuHiderItems,
	ribbonHiderPage,
	setShown,
	statusbarHiderPage,
} from "./declarativeHiders";

/**
 * Commander's settings tab, built from `getSettingDefinitions()` (Obsidian
 * 1.13+). Per-area definitions live in the `declarative*.ts` files; controls
 * that aren't plain settings keys are routed by a key prefix (`hide|`,
 * `toolbar|`) in `getControlValue` / `setControlValue`.
 */
export default class CommanderSettingTab extends PluginSettingTab {
	private plugin: CommanderPlugin;

	public constructor(plugin: CommanderPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	public getControlValue(key: string): unknown {
		if (isToolbarKey(key)) return getToolbarValue(this.plugin, key);
		if (isHideKey(key)) return isShown(this.plugin, key);
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	public async setControlValue(key: string, value: unknown): Promise<void> {
		if (isToolbarKey(key)) {
			await setToolbarValue(this.plugin, key, value);
			return;
		}
		if (isHideKey(key)) {
			await setShown(this.plugin, key, value as boolean);
			return;
		}
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		if (key === "spacing") updateSpacing(value as number);
		if (key === "showAddCommand") await this.plugin.manager.pageHeader.reorder();
		await this.plugin.saveSettings();
	}

	public getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "group",
				heading: t("General"),
				items: [
					{
						name: t("Always ask before removing?"),
						desc: t(
							"Always show a Popup to confirm deletion of a Command."
						),
						control: { type: "toggle", key: "confirmDeletion" },
					},
					{
						name: t('Show "Add Command" Button'),
						desc: t('Show the "Add Command" Button in every Menu.'),
						control: { type: "toggle", key: "showAddCommand" },
					},
					{
						name: t("Choose custom spacing for Command Buttons"),
						desc: t(
							"Change the spacing between commands. You can set different values on mobile and desktop."
						),
						control: {
							type: "slider",
							key: "spacing",
							min: 0,
							max: 32,
							step: 1,
						},
					},
				],
			},
			...this.commandPages(),
			{
				type: "group",
				items: [this.aboutRow()],
			},
		];
	}

	/** No declarative equivalent, so About is a `render` row mounting Preact. */
	private aboutRow(): SettingGroupItem {
		return {
			name: t("About"),
			searchable: false,
			render: (setting): (() => void) => {
				setting.settingEl.empty();
				setting.settingEl.addClass("cmdr-about-row");
				render(h(About, { manifest: this.plugin.manifest }), setting.settingEl);
				return (): void => render(null, setting.settingEl);
			},
		};
	}

	/** One page per command location, each built from the shared command list. */
	private commandPages(): SettingDefinitionItem[] {
		const {
			leftRibbon,
			statusBar,
			editorMenu,
			fileMenu,
			pageHeader,
			explorerManager,
			textToolbarIntegration,
		} = this.plugin.manager;
		const update = (): void => this.update();
		const list = (
			manager: CommandManagerBase,
			heading: string,
			options?: CommandListOptions
		): SettingDefinitionItem =>
			commandListDefinition(this.plugin, manager, heading, update, options);

		return [
			{
				type: "page",
				name: t("Left Ribbon"),
				desc: t("Commands shown in the left ribbon"),
				items: [
					list(leftRibbon, t("Ribbon commands")),
					ribbonHiderPage(this.plugin),
				],
			},
			{
				type: "page",
				name: t("Statusbar"),
				desc: t("Commands shown in the status bar"),
				items: [
					list(statusBar, t("Statusbar commands")),
					statusbarHiderPage(this.plugin),
				],
			},
			{
				type: "page",
				name: t("Page Header"),
				desc: t("Commands shown in the note header"),
				items: [
					list(pageHeader, t("Page header commands")),
				],
			},
			{
				type: "page",
				name: t("Explorer"),
				desc: t("Commands shown in the file explorer"),
				items: [
					list(explorerManager, t("Explorer commands")),
					{
						type: "group",
						heading: t("Warning"),
						items: [
							{
								name: t("Explorer focus"),
								desc: t(
									"When clicking on a Command in the Explorer, the Explorer view will become focused. This might interfere with Commands that are supposed to be executed on an active File/Explorer."
								),
							},
						],
					},
				],
			},
			{
				type: "page",
				name: t("Editor Menu"),
				desc: t("Commands in the editor right-click menu"),
				items: [
					list(editorMenu, t("Editor menu commands")),
					...menuHiderItems(this.plugin, "editorMenuItems", update),
				],
			},
			{
				type: "page",
				name: t("File Menu"),
				desc: t("Commands in the file right-click menu"),
				items: [
					list(fileMenu, t("File menu commands")),
					...menuHiderItems(this.plugin, "fileMenuItems", update),
				],
			},
			{
				type: "page",
				name: t("Text Toolbar"),
				desc: t("Commands in the Text Formatting Toolbar plugin"),
				// Only when the external Text Toolbar plugin exposes its API.
				visible: (): boolean =>
					TextToolbarIntegrationManager.isAvailable(this.plugin),
				items: [
					list(textToolbarIntegration, t("Text toolbar commands"), {
						showMode: false,
						showColor: false,
					}),
				],
			},
			toolbarPage(this.plugin, update),
			macrosPage(this.plugin, update),
		];
	}
}
