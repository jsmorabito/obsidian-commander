import {
	Platform,
	PluginSettingTab,
	SettingDefinitionItem,
} from "obsidian";
import { h, render } from "preact";
import CommanderPlugin from "../main";
import settingTabComponent from "./components/settingTabComponent";
import { updateSpacing } from "../util";
import { commandListDefinition } from "./declarativeCommandList";

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
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	public async setControlValue(key: string, value: unknown): Promise<void> {
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
		];
	}

	/** One page per command location; each is a shared list definition. */
	private commandPages(): SettingDefinitionItem[] {
		const { leftRibbon, statusBar } = this.plugin.manager;
		const update = (): void => this.update();
		return [
			{
				type: "page",
				name: "Left Ribbon",
				desc: "Commands shown in the left ribbon",
				items: [
					commandListDefinition(
						this.plugin,
						leftRibbon,
						"Ribbon commands",
						update
					),
				],
			},
			{
				type: "page",
				name: "Statusbar",
				desc: "Commands shown in the status bar",
				items: [
					commandListDefinition(
						this.plugin,
						statusBar,
						"Statusbar commands",
						update
					),
				],
			},
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
