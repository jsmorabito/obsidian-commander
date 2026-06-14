import { Platform } from "obsidian";
import { Fragment, h } from "preact";
import t from "src/l10n";
import CommanderPlugin from "src/main";
import { Macro } from "src/types";
import { ObsidianIcon, updateMacroCommands } from "src/util";
import ConfirmDeleteModal from "../confirmDeleteModal";
import Logo from "./Logo";
import MacroBuilderModal from "./MacroBuilderModal";

interface MacroBuilderProps {
	plugin: CommanderPlugin;
	macros: Macro[];
}
export default function MacroViewer({
	plugin,
	macros,
}: MacroBuilderProps): h.JSX.Element {
	const handleBuilder = (macro: Macro, idx?: number): void => {
		const onClose = (updatedMacro: Macro): void => {
			macros.splice(
				idx !== undefined ? idx : macros.length,
				idx !== undefined ? 1 : 0,
				updatedMacro
			);

			plugin.saveSettings();
			this.forceUpdate();
			updateMacroCommands(plugin);
			modal.close();
		};
		const modal = new MacroBuilderModal(plugin, macro, onClose);
		modal.open();
	};

	const handleDelete = (idx: number): void => {
		macros.splice(idx, 1);
		plugin.saveSettings();
		this.forceUpdate();
		updateMacroCommands(plugin);
	};

	return (
		<Fragment>
			<div className="cmdr-sep-con">
				{macros.map((item, idx) => (
					<div class="setting-item mod-toggle">
						<div className="setting-item-info">
							<div className="setting-item-name">{item.name}</div>
							<div className="setting-item-description">
								{item.macro.length} Actions
							</div>
						</div>
						<div className="setting-item-control">
							<button
								aria-label="Edit Macro"
								onClick={(): void => handleBuilder(item, idx)}
							>
								<ObsidianIcon icon="lucide-pencil" />
							</button>
							<button
								aria-label="Delete"
								class="mod-warning"
								onClick={async (): Promise<void> => {
									if (
										!plugin.settings.confirmDeletion ||
										(await new ConfirmDeleteModal(
											plugin
										).didChooseRemove())
									) {
										handleDelete(idx);
									}
								}}
							>
								<ObsidianIcon icon="trash" />
							</button>
						</div>
					</div>
				))}
			</div>
			{!macros.length && (
				<div class="cmdr-commands-empty">
					{/* This isn't really dangerous,
					as the svg is inserted at build time and no other data can be passed to it */}
					<Logo />
					<h3>No Macros yet!</h3>
					<span>{t("Would you like to add one now?")}</span>
				</div>
			)}

			{Platform.isMobile && <hr />}

			<div className="cmdr-add-new-wrapper">
				<button
					class="mod-cta"
					onClick={(): void =>
						handleBuilder({ name: "", macro: [], icon: "star" })
					}
				>
					Add Macro
				</button>
			</div>
		</Fragment>
	);
}
