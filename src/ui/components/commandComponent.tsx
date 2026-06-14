import { Notice, Platform } from "obsidian";
import { Fragment, h } from "preact";
import t from "src/l10n";
import { CommandIconPair } from "src/types";
import { getCommandFromId, ObsidianIcon } from "src/util";
import MobileModifyModal from "../mobileModifyModal";
import ChangeableText from "./ChangeableText";
import { ColorPicker } from "./ColorPicker";
import CommanderPlugin from "src/main";

interface CommandViewerProps {
	plugin: CommanderPlugin;
	pair: CommandIconPair;
	handleRemove: () => void;
	handleUp: () => void;
	handleDown: () => void;
	handleNewIcon: () => void;
	// eslint-disable-next-line no-unused-vars
	handleRename: (_name: string) => void;
	// eslint-disable-next-line no-unused-vars
	handleModeChange: (_mode?: string) => void;
	// eslint-disable-next-line no-unused-vars
	handleColorChange: (_color?: string) => void;
	sortable?: boolean;
}

export default function CommandComponent({
	plugin,
	pair,
	handleRemove,
	handleDown,
	handleUp,
	handleNewIcon,
	handleRename,
	handleModeChange,
	handleColorChange,
	sortable = true,
}: CommandViewerProps): h.JSX.Element {
	const cmd = getCommandFromId(pair.id, plugin);
	if (!cmd) {
		return (
			<Fragment>
				{Platform.isDesktop && (
					<div className="setting-item mod-toggle">
						<ObsidianIcon
							icon="alert-triangle"
							size={20}
							className="cmdr-icon clickable-icon mod-warning"
						/>
						<div className="setting-item-info">
							<div className="setting-item-name">{pair.name}</div>
							<div className="setting-item-description">
								{t(
									"This Command is not available on this device."
								)}
							</div>
						</div>
						<div className="setting-item-control">
							<button
								className="mod-warning"
								style="display: flex"
								onClick={handleRemove}
								aria-label={t("Delete")}
							>
								<ObsidianIcon icon="lucide-trash" />
							</button>
						</div>
					</div>
				)}
				{Platform.isMobile && (
					<div
						className="mobile-option-setting-item"
						onClick={(): void => {
							new Notice(
								t(
									"This Command is not available on this device."
								)
							);
						}}
					>
						<span
							className="mobile-option-setting-item-remove-icon"
							onClick={handleRemove}
						>
							<ObsidianIcon
								icon="minus-with-circle"
								size={22}
								style={{ color: "var(--text-error)" }}
							/>
						</span>
						<span className="mobile-option-setting-item-option-icon mod-warning">
							<ObsidianIcon icon={"alert-triangle"} size={22} />
						</span>
						<span className="mobile-option-setting-item-name">
							{pair.name}
						</span>
					</div>
				)}
			</Fragment>
		);
	}
	const owningPluginID = cmd.id.split(":").first();
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const owningPlugin = plugin.app.plugins.manifests[owningPluginID!];
	const isInternal = !owningPlugin;
	const isChecked =
		cmd.hasOwnProperty("checkCallback") ||
		cmd.hasOwnProperty("editorCheckCallback");

	const modeIcon = getModeIcon(pair.mode);
	const modeName = pair.mode.match(/desktop|mobile|any/)
		? pair.mode[0].toUpperCase() + pair.mode.substring(1)
		: t("This device");

	return (
		<Fragment>
			{Platform.isDesktop && (
				<div className="setting-item mod-toggle">
					<ObsidianIcon
						icon={pair.icon}
						size={20}
						aria-label={t("Choose new")}
						onClick={handleNewIcon}
						className="cmdr-icon clickable-icon"
					/>
					<div className="setting-item-info">
						<div className="setting-item-name">
							<ChangeableText
								ariaLabel={t("Double click to rename")}
								handleChange={({ target }): void => {
									/* @ts-ignore */
									handleRename(target?.value);
								}}
								value={pair.name}
							/>
							{pair.name !== cmd.name && (
								<span style="margin-left: .8ex">
									({cmd.name})
								</span>
							)}
						</div>
						<div className="setting-item-description">
							{t(
								"Added by {{plugin_name}}.".replace(
									"{{plugin_name}}",
									isInternal ? "Obsidian" : owningPlugin.name
								)
							)}{" "}
							{isChecked
								? t(
										"Warning: This is a checked Command, meaning it might not run under every circumstance."
									)
								: ""}
						</div>
					</div>
					<div className="setting-item-control">
						<ColorPicker
							initialColor={pair.color ?? "#000"}
							onChange={handleColorChange}
						/>
						{sortable && (
							<>
								<ObsidianIcon
									icon="arrow-down"
									className="setting-editor-extra-setting-button clickable-icon"
									onClick={handleDown}
									aria-label={t("Move down")}
								/>
								<ObsidianIcon
									icon="arrow-up"
									className="setting-editor-extra-setting-button clickable-icon"
									onClick={handleUp}
									aria-label={t("Move up")}
								/>
							</>
						)}
						<ObsidianIcon
							icon={modeIcon}
							className="setting-editor-extra-setting-button clickable-icon"
							onClick={(): void => handleModeChange()}
							aria-label={t(
								"Change Mode (Currently: {{current_mode}})"
							).replace("{{current_mode}}", modeName)}
						/>
						<button
							className="mod-warning"
							style="display: flex"
							onClick={handleRemove}
							aria-label={t("Delete")}
						>
							<ObsidianIcon icon="lucide-trash" />
						</button>
					</div>
				</div>
			)}

			{Platform.isMobile && (
				<div className="mobile-option-setting-item">
					<span
						className="mobile-option-setting-item-remove-icon"
						onClick={handleRemove}
					>
						<ObsidianIcon
							icon="minus-with-circle"
							size={22}
							style={{ color: "var(--text-error)" }}
						/>
					</span>
					<span className="mobile-option-setting-item-option-icon">
						<ObsidianIcon
							icon={pair.icon}
							size={22}
							onClick={(): void => {
								new MobileModifyModal(
									plugin,
									pair,
									handleRename,
									handleNewIcon,
									handleModeChange,
									handleColorChange
								).open();
							}}
						/>
					</span>
					<span
						className="mobile-option-setting-item-name"
						onClick={(): void => {
							new MobileModifyModal(
								plugin,
								pair,
								handleRename,
								handleNewIcon,
								handleModeChange,
								handleColorChange
							).open();
						}}
					>
						{pair.name}
						{pair.name !== cmd.name && (
							<span className="cmdr-option-setting-name">
								({cmd.name})
							</span>
						)}
					</span>
					<span className="mobile-option-setting-item-option-icon">
						{sortable && (
							<>
								<ObsidianIcon
									icon="arrow-down"
									className="clickable-icon"
									onClick={handleDown}
								/>
								<ObsidianIcon
									icon="arrow-up"
									className="clickable-icon"
									onClick={handleUp}
								/>
							</>
						)}
						<ObsidianIcon
							icon="three-horizontal-bars"
							className="clickable-icon"
							onClick={(): void => {
								new MobileModifyModal(
									plugin,
									pair,
									handleRename,
									handleNewIcon,
									handleModeChange,
									handleColorChange
								).open();
							}}
						/>
					</span>
				</div>
			)}
		</Fragment>
	);
}

function getModeIcon(mode: string): string {
	if (mode === "mobile") return "smartphone";
	if (mode === "desktop") return "monitor";
	if (mode === "any") return "cmdr-all-devices";
	return "airplay";
}
