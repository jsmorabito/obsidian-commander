import { createContext, Fragment, h } from "preact";
import { useState } from "preact/hooks";
import CommanderPlugin from "src/main";
import CommandComponent from "./commandComponent";
import CommandManagerBase from "src/manager/commands/commandManager";
import { chooseNewCommand, isModeActive } from "src/util";
import { arrayMoveMutable } from "array-move";
import ChooseIconModal from "../chooseIconModal";
import ConfirmDeleteModal from "../confirmDeleteModal";
import t from "src/l10n";
import { Platform } from "obsidian";
import Logo from "./Logo";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const ManagerContext = createContext<CommandManagerBase>(null!);

interface CommandViewerProps {
	manager: CommandManagerBase;
	plugin: CommanderPlugin;
	children?: h.JSX.Element | h.JSX.Element[];
	sortable?: boolean;
}
export default function CommandViewer({
	manager,
	plugin,
	children,
	sortable = true,
}: CommandViewerProps): h.JSX.Element {
	const [, rerender] = useState(0);
	const forceUpdate = (): void => rerender((n) => n + 1);
	return (
		<Fragment>
			<ManagerContext.Provider value={manager}>
				<div className="cmdr-sep-con">
					{manager.pairs.map((cmd, idx) => {
						if (
							cmd.mode.match(/desktop|mobile|any/) ||
							cmd.mode === plugin.app.appId
						) {
							return (
								<CommandComponent
									plugin={plugin}
									sortable={sortable}
									key={cmd.id}
									pair={cmd}
									handleRemove={async (): Promise<void> => {
										if (
											!plugin.settings.confirmDeletion ||
											(await new ConfirmDeleteModal(
												plugin
											).didChooseRemove())
										) {
											await manager.removeCommand(cmd);
											forceUpdate();
										}
									}}
									handleUp={(): void => {
										arrayMoveMutable(
											manager.pairs,
											idx,
											idx - 1
										);
										manager.reorder();
										forceUpdate();
									}}
									handleDown={(): void => {
										arrayMoveMutable(
											manager.pairs,
											idx,
											idx + 1
										);
										manager.reorder();
										forceUpdate();
									}}
									handleRename={async (
										name
									): Promise<void> => {
										cmd.name = name;
										await plugin.saveSettings();
										manager.reorder();
										forceUpdate();
									}}
									handleNewIcon={async (): Promise<void> => {
										const newIcon =
											await new ChooseIconModal(
												plugin
											).awaitSelection();
										if (newIcon && newIcon !== cmd.icon) {
											cmd.icon = newIcon;
											await plugin.saveSettings();
											manager.reorder();
											forceUpdate();
										}
										dispatchEvent(
											new Event("cmdr-icon-changed")
										);
									}}
									handleModeChange={async (
										mode?: string
									): Promise<void> => {
										// This is the rotation
										const modes = [
											"any",
											"desktop",
											"mobile",
											plugin.app.appId,
										];
										let currentIdx = modes.indexOf(
											cmd.mode
										);
										if (currentIdx === 3) currentIdx = -1;

										cmd.mode =
											mode || modes[currentIdx + 1];
										await plugin.saveSettings();
										manager.reorder();
										forceUpdate();
									}}
									handleColorChange={async (
										color?: string
									): Promise<void> => {
										cmd.color = color;
										await plugin.saveSettings();
										manager.reorder();
									}}
								/>
							);
						}
					})}
				</div>
				{!manager.pairs.some(
					(pre) =>
						isModeActive(pre.mode, plugin) ||
						pre.mode.match(/mobile|desktop/)
				) && (
					<div class="cmdr-commands-empty">
						{/* This isn't really dangerous,
					as the svg is inserted at build time and no other data can be passed to it */}
						<Logo />
						<h3>{t("No commands here!")}</h3>
						<span>{t("Would you like to add one now?")}</span>
					</div>
				)}

				{Platform.isMobile && <hr />}

				<div className="cmdr-add-new-wrapper">
					<button
						className="mod-cta"
						onClick={async (): Promise<void> => {
							const pair = await chooseNewCommand(plugin);
							await manager.addCommand(pair);
							manager.reorder();
							forceUpdate();
						}}
					>
						{t("Add command")}
					</button>
				</div>
			</ManagerContext.Provider>

			{children}
		</Fragment>
	);
}
