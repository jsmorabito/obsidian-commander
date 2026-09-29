import {
	Platform,
	PluginSettingTab,
	SettingDefinitionItem,
	SettingGroupItem,
} from "obsidian";
import { h, render } from "preact";
import CommanderPlugin from "../main";
import CommandManagerBase from "../manager/commands/commandManager";
import About from "./components/About";
import settingTabComponent from "./components/settingTabComponent";
import { updateSpacing } from "../util";
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
 * SPIKE: declarative settings (Obsidian 1.13+). Throwaway experiment.
 * Covers the General controls plus one command list (Left Ribbon) to test
 * whether `list` can replace CommandViewer. `display()` is left in place
 * (Path B) but is bypassed on 1.13+ because getSettingDefinitions() is non-empty.
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
				heading: "General",
				items: [
					{
						name: "Always ask before removing?",
						desc: "Always show a Popup to confirm deletion of a Command.",
						control: { type: "toggle", key: "confirmDeletion" },
					},
					{
						name: 'Show "Add Command" Button',
						desc: 'Show the "Add Command" Button in every Menu.',
						control: { type: "toggle", key: "showAddCommand" },
					},
					{
						name: "Choose custom spacing for Command Buttons",
						desc: "Change the spacing between commands.",
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

	/**
	 * The About block (logo, credits, feedback/donate links, version). Has no
	 * declarative equivalent, so it's a `render` row that mounts the existing
	 * Preact component and unmounts it on teardown.
	 */
	private aboutRow(): SettingGroupItem {
		return {
			name: "About",
			searchable: false,
			render: (setting): (() => void) => {
				setting.settingEl.empty();
				setting.settingEl.addClass("cmdr-about-row");
				render(h(About, { manifest: this.plugin.manifest }), setting.settingEl);
				return (): void => render(null, setting.settingEl);
			},
		};
	}

	/** One page per command location; each is a shared list definition. */
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
				name: "Left Ribbon",
				desc: "Commands shown in the left ribbon",
				items: [
					list(leftRibbon, "Ribbon commands"),
					ribbonHiderPage(this.plugin),
				],
			},
			{
				type: "page",
				name: "Statusbar",
				desc: "Commands shown in the status bar",
				items: [
					list(statusBar, "Statusbar commands"),
					statusbarHiderPage(this.plugin),
				],
			},
			{
				type: "page",
				name: "Page Header",
				desc: "Commands shown in the note header",
				items: [
					list(pageHeader, "Page header commands"),
				],
			},
			{
				type: "page",
				name: "Explorer",
				desc: "Commands shown in the file explorer",
				items: [
					list(explorerManager, "Explorer commands"),
					{
						type: "group",
						heading: "Warning",
						items: [
							{
								name: "Explorer focus",
								desc: "When clicking on a Command in the Explorer, the Explorer view will become focused. This might interfere with Commands that are supposed to be executed on an active File/Explorer.",
							},
						],
					},
				],
			},
			{
				type: "page",
				name: "Editor Menu",
				desc: "Commands in the editor right-click menu",
				items: [
					list(editorMenu, "Editor menu commands"),
					...menuHiderItems(this.plugin, "editorMenuItems", update),
				],
			},
			{
				type: "page",
				name: "File Menu",
				desc: "Commands in the file right-click menu",
				items: [
					list(fileMenu, "File menu commands"),
					...menuHiderItems(this.plugin, "fileMenuItems", update),
				],
			},
			{
				type: "page",
				name: "Text Toolbar",
				desc: "Commands in the Text Formatting Toolbar plugin",
				// Only when the external Text Toolbar plugin exposes its API.
				visible: (): boolean =>
					TextToolbarIntegrationManager.isAvailable(this.plugin),
				items: [
					list(textToolbarIntegration, "Text toolbar commands", {
						showMode: false,
						showColor: false,
					}),
				],
			},
			toolbarPage(this.plugin, update),
			macrosPage(this.plugin, update),
		];
	}

	public display(): void {
		render(
			h(settingTabComponent, {
				plugin: this.plugin,
				mobileMode: Platform.isMobile,
			}),
			this.containerEl
		);
	}

	public hide(): void {
		render(null, this.containerEl);
	}
}
