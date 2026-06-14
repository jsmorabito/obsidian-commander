import { Notice, Platform, setIcon, Setting } from "obsidian";
import { Fragment, h } from "preact";
import { useEffect, useRef } from "preact/hooks";
import CommanderPlugin from "src/main";
import { injectIcons, ObsidianIcon, updateStyles } from "src/util";
import ChooseIconModal from "../chooseIconModal";

function render(containerEl: HTMLElement, plugin: CommanderPlugin): void {
	containerEl.empty();

	new Setting(containerEl)
		.setName("Toolbar Row Count")
		.setDesc(
			"Set how many Rows the Mobile Toolbar should have. Set this to 0 to remove the Toolbar."
		)
		.addSlider((cb) =>
			cb
				.setLimits(0, 5, 1)
				.setValue(plugin.settings.advancedToolbar.rowCount)
				.setDynamicTooltip()
				.onChange(async (value) => {
					plugin.settings.advancedToolbar.rowCount = value;
					await plugin.saveSettings();
					updateStyles(plugin.settings.advancedToolbar);
				})
		);

	new Setting(containerEl)
		.setName("Column Layout")
		.setDesc(
			"Use a column based layout instead of the default row. This makes it easier to arrange the Commands."
		)
		.addToggle((cb) =>
			cb
				.setValue(plugin.settings.advancedToolbar.columnLayout)
				.onChange(async (value) => {
					plugin.settings.advancedToolbar.columnLayout = value;
					await plugin.saveSettings();
					updateStyles(plugin.settings.advancedToolbar);
				})
		);

	// new Setting(containerEl)
	// 	.setName("Show Tooltips for Quick Actions")
	// 	.setDesc("Show Tooltips over the Quick Actions on hover. This helps to more easily identify Commands. IMPORTANT: Only works with a Stylus/Apple Pen/Mouse")
	// 	.addToggle(cb => {
	// 		cb.setValue(plugin.settings.advancedToolbar.tooltips)
	// 			.onChange(async (value) => {
	// 				plugin.settings.advancedToolbar.tooltips = value;
	// 				await plugin.saveSettings();
	// 			})
	// 	})

	new Setting(containerEl)
		.setName("Bottom Offset")
		.setDesc(
			"Offset the Toolbar from the Bottom of the Screen. This is useful if the toolbar is partially obscured by other UI Elements."
		)
		.addSlider((cb) =>
			cb
				.setLimits(0, 32, 1)
				.setValue(plugin.settings.advancedToolbar.heightOffset)
				.setDynamicTooltip()
				.onChange(async (value) => {
					plugin.settings.advancedToolbar.heightOffset = value;
					await plugin.saveSettings();
					updateStyles(plugin.settings.advancedToolbar);
				})
		);

	if (Platform.isMobile) {
		const description = document.createDocumentFragment();
		description.appendChild(createEl("h3", { text: "Custom Icons" }));
		containerEl.appendChild(description);

		plugin.getCommandsWithoutIcons().forEach((command) => {
			new Setting(containerEl)
				.setName(command.name)
				.setDesc(`ID: ${command.id}`)
				.addButton((bt) => {
					const iconDiv = bt.buttonEl.createDiv({
						cls: "AT-settings-icon",
					});
					if (command.icon) {
						setIcon(iconDiv, command.icon);
					} else {
						const currentIcon =
							plugin.settings.advancedToolbar.mappedIcons.find(
								(m) => m.commandID === command.id
							)?.iconID;
						currentIcon
							? setIcon(iconDiv, currentIcon)
							: bt.setButtonText("No Icon");
					}
					bt.onClick(async () => {
						const icon = await new ChooseIconModal(
							plugin
						).awaitSelection();
						const mappedIcon =
							plugin.settings.advancedToolbar.mappedIcons.find(
								(m) => m.commandID === command.id
							);
						if (mappedIcon) {
							mappedIcon.iconID = icon;
						} else {
							plugin.settings.advancedToolbar.mappedIcons.push({
								commandID: command.id,
								iconID: icon,
							});
						}
						await plugin.saveSettings();
						injectIcons(plugin.settings.advancedToolbar, plugin);
						render(containerEl, plugin);
					});
				})
				.addExtraButton((bt) => {
					bt.setIcon("reset")
						.setTooltip("Reset to default - Requires a restart")
						.onClick(async () => {
							plugin.settings.advancedToolbar.mappedIcons =
								plugin.settings.advancedToolbar.mappedIcons.filter(
									(p) => p.commandID !== command.id
								);
							delete command.icon;
							delete plugin.app.commands.commands[command.id].icon;
							await plugin.saveSettings();
							render(containerEl, plugin);
							new Notice(
								"If the default Icon doesn't appear, you might have to restart Obsidian."
							);
						});
				});
		});
	}

	const advancedEl = containerEl.appendChild(
		createEl("div", {
			cls: "cmdr-sep-con",
			attr: { style: "margin-top: 64px" },
		})
	);
	advancedEl.appendChild(
		createEl("div", {
			text: "Advanced Settings",
			attr: { style: "margin-bottom: 8px; font-weight: bold" },
		})
	);

	new Setting(advancedEl)
		.setName("Button Height")
		.setDesc(
			"Change the Height of each Button inside the Mobile Toolbar (in px)."
		)
		.addText((cb) =>
			cb
				.setValue(
					plugin.settings.advancedToolbar.rowHeight?.toString() ??
						"48"
				)
				.setPlaceholder("48")
				.onChange(async (value) => {
					const height = Number(value);
					const invalid = isNaN(height);
					cb.inputEl.toggleClass("is-invalid", invalid);
					if (!invalid) {
						plugin.settings.advancedToolbar.rowHeight = height;
						await plugin.saveSettings();
						updateStyles(plugin.settings.advancedToolbar);
					}
				})
		);
	new Setting(advancedEl)
		.setName("Button Width")
		.setDesc(
			"Change the Width of each Button inside the Mobile Toolbar (in px)."
		)
		.addText((cb) =>
			cb
				.setValue(
					plugin.settings.advancedToolbar.buttonWidth?.toString() ??
						"48"
				)
				.setPlaceholder("48")
				.onChange(async (value) => {
					const width = Number(value);
					const invalid = isNaN(width);
					cb.inputEl.toggleClass("is-invalid", invalid);
					if (!invalid) {
						plugin.settings.advancedToolbar.buttonWidth = width;
						await plugin.saveSettings();
						updateStyles(plugin.settings.advancedToolbar);
					}
				})
		);
	new Setting(advancedEl)
		.setName("Toolbar Extra Spacing")
		.setDesc(
			"Some Themes need extra spacing in the toolbar. If your Toolbar doesn't wrap properly, try increasing this value."
		)
		.addSlider((cb) =>
			cb
				.setLimits(0, 64, 1)
				.setValue(plugin.settings.advancedToolbar.spacing)
				.setDynamicTooltip()
				.onChange(async (value) => {
					plugin.settings.advancedToolbar.spacing = value;
					await plugin.saveSettings();
					updateStyles(plugin.settings.advancedToolbar);
				})
		);
}

export default function AdvancedToolbarSettings({
	plugin,
}: {
	plugin: CommanderPlugin;
}): h.JSX.Element {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (ref.current) {
			render(ref.current, plugin);
		}
		return () => ref.current && ref.current.empty();
	}, []);

	return (
		<Fragment>
			<div className="cmdr-sep-con callout" data-callout="info">
				<span className="cmdr-callout-warning">
					<ObsidianIcon icon="alert-circle" /> {"Info"}
				</span>
				<p className="cmdr-warning-description">
					{"The Toolbar is only available in Obsidian Mobile. "}
					{Platform.isMobile && (
						<>
							{
								"To configure which Commands show up in the Toolbar, open the Mobile Settings."
							}
						</>
					)}
				</p>
				{Platform.isMobile && (
					<button
						onClick={(): void => {
							plugin.app.setting.openTabById("mobile");
						}}
						className="mod-cta"
					>
						{"Open Mobile Settings"}
					</button>
				)}
			</div>
			<div ref={ref} style={{ paddingBottom: "128px" }} />
		</Fragment>
	);
}
