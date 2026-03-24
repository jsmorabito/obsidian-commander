import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import t from "src/l10n";
import { ObsidianIcon } from "src/util";
import MobileModifyModal from "../mobileModifyModal";
import { ColorPicker } from "./ColorPicker";
import CommanderPlugin from "src/main";

export default function MobileModifyComponent({
	plugin,	
	modal: controller,
}: {
	plugin: CommanderPlugin;
	modal: MobileModifyModal;
}): h.JSX.Element {
	const [, rerender] = useState(0);
	useEffect(() => {
		const update = (): void => {
			rerender((n) => n + 1);
		};
		addEventListener("cmdr-icon-changed", update);
		return () => removeEventListener("cmdr-icon-changed", update);
	}, []);

	return (
		<div className="cmdr-mobile-modify-grid">
			<div
				className="cmdr-mobile-modify-option"
				onClick={controller.handleNewIcon}
			>
				<span>{t("Icon")}</span>
				<span className="cmdr-flex cmdr-gap-1">
					<ObsidianIcon
						icon={controller.pair.icon}
						size={20}
						className="clickable-icon"
						style={{ marginRight: "0px" }}
					/>
					<ColorPicker
						initialColor={controller.pair.color ?? "#000"}
						onChange={controller.handleColorChange}
					/>
				</span>
			</div>
			<div className="cmdr-mobile-modify-option">
				<span>{t("Name")}</span>
				<input
					onBlur={({ currentTarget }): void =>
						controller.handleRename(currentTarget.value)
					}
					type="text"
					placeholder={t("Custom Name")}
					value={controller.pair.name}
				/>
			</div>
			<div className="cmdr-mobile-modify-option">
				<select
					className="dropdown"
					value={controller.pair.mode}
					onChange={({ currentTarget }): void =>
						controller.handleModeChange(currentTarget.value)
					}
				>
					<option value="any">
						{t("Add command to all devices")}
					</option>
					<option value="mobile">
						{t("Add command only to mobile devices")}
					</option>
					<option value="desktop">
						{t("Add command only to desktop devices")}
					</option>
					<option value={plugin.app.appId}>
						{t("Add command only to this device")}
					</option>
				</select>
			</div>
			<div className="modal-button-container">
				<button
					className="mod-cta"
					onClick={(): void => controller.close()}
				>
					{t("Done")}
				</button>
			</div>
		</div>
	);
}
