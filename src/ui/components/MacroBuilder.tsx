import { h } from "preact";
import { useState } from "preact/hooks";
import CommanderPlugin from "src/main";
import { Macro, Action, MacroItem } from "src/types";
import { getCommandFromId, ObsidianIcon } from "src/util";
import AddCommandModal from "../addCommandModal";
import ChooseIconModal from "../chooseIconModal";
import { SliderComponent } from "./settingComponent";

interface MacroBuilderProps {
	plugin: CommanderPlugin;
	macro: Macro;
	// eslint-disable-next-line no-unused-vars
	onSave: (macro: Macro) => void;
	onCancel: () => void;
}
export default function ({
	plugin,
	macro,
	onSave,
	onCancel,
}: MacroBuilderProps): h.JSX.Element {
	const [name, setName] = useState(macro.name || "Macro Name");
	const [icon, setIcon] = useState(macro.icon || "star");
	const [startup, setStartup] = useState(macro.startup || false);
	const [macroCommands, setMacroCommands] = useState<MacroItem[]>(
		JSON.parse(JSON.stringify(macro.macro)) || []
	);

	const handleAddCommand = async (): Promise<void> => {
		const command = await new AddCommandModal(plugin).awaitSelection();
		if (command) {
			setMacroCommands([
				...macroCommands,
				{ action: Action.COMMAND, commandId: command.id },
			]);
		}
	};

	const handleAddDelay = async (): Promise<void> => {
		setMacroCommands([
			...macroCommands,
			{ action: Action.DELAY, delay: 250 },
		]);
	};

	return (
		<div>
			<div class="setting-item cmdr-mm-item">
				<div>
					<span>Name</span>
					<input
						type="text"
						placeholder="Macro Name"
						value={name}
						onChange={(e): void => setName(e.currentTarget.value)}
						width="100%"
					/>
				</div>
				<div>
					<span>Icon</span>
					<button
						onClick={async (): Promise<void> =>
							setIcon(
								await new ChooseIconModal(
									plugin
								).awaitSelection()
							)
						}
					>
						<ObsidianIcon icon={icon} />
					</button>
				</div>
			</div>

			{macroCommands.map((item, idx) => {
				switch (item.action) {
					case Action.COMMAND: {
						const command = getCommandFromId(
							item.commandId,
							plugin
						);
						return (
							<div class="setting-item cmdr-mm-item">
								<div>
									<button
										onClick={async (): Promise<void> => {
											const newId =
												await new AddCommandModal(
													plugin
												).awaitSelection();
											setMacroCommands(
												macroCommands.map((item, i) => {
													if (i === idx) {
														return {
															...item,
															commandId: newId.id,
														};
													}
													return item;
												})
											);
										}}
									>
										{command?.name || "Cannot find Command"}
									</button>
								</div>
								<div>
									<div class="cmdr-mm-action-options">
										<ObsidianIcon
											class="clickable-icon"
											icon="arrow-down"
											onClick={(): void => {
												if (
													idx ===
													macroCommands.length - 1
												)
													return;
												const newCommands = [
													...macroCommands,
												];
												const temp = newCommands[idx];
												newCommands[idx] =
													newCommands[idx + 1];
												newCommands[idx + 1] = temp;
												setMacroCommands(newCommands);
											}}
										/>
										<ObsidianIcon
											class="clickable-icon"
											icon="arrow-up"
											onClick={(): void => {
												if (idx === 0) return;
												const newCommands = [
													...macroCommands,
												];
												const temp = newCommands[idx];
												newCommands[idx] =
													newCommands[idx - 1];
												newCommands[idx - 1] = temp;
												setMacroCommands(newCommands);
											}}
										/>
										<ObsidianIcon
											class="clickable-icon"
											icon="cross"
											onClick={(): void => {
												setMacroCommands(
													macroCommands.filter(
														(_, i) => i !== idx
													)
												);
											}}
										/>
									</div>
								</div>
							</div>
						);
					}
					case Action.DELAY:
						return (
							<div class="setting-item cmdr-mm-item">
								<div>
									<SliderComponent
										name="Delay"
										min={0}
										max={10000}
										step={50}
										description="Delay in milliseconds"
										value={item.delay}
										changeHandler={(value): void =>
											(item.delay = value)
										}
									/>
								</div>
								<div>
									<div class="cmdr-mm-action-options">
										<ObsidianIcon
											class="clickable-icon"
											icon="arrow-down"
											onClick={(): void => {
												if (
													idx ===
													macroCommands.length - 1
												)
													return;
												const newCommands = [
													...macroCommands,
												];
												const temp = newCommands[idx];
												newCommands[idx] =
													newCommands[idx + 1];
												newCommands[idx + 1] = temp;
												setMacroCommands(newCommands);
											}}
										/>
										<ObsidianIcon
											class="clickable-icon"
											icon="arrow-up"
											onClick={(): void => {
												if (idx === 0) return;
												const newCommands = [
													...macroCommands,
												];
												const temp = newCommands[idx];
												newCommands[idx] =
													newCommands[idx - 1];
												newCommands[idx - 1] = temp;
												setMacroCommands(newCommands);
											}}
										/>
										<ObsidianIcon
											class="clickable-icon"
											icon="cross"
											onClick={(): void => {
												setMacroCommands(
													macroCommands.filter(
														(_, i) => i !== idx
													)
												);
											}}
										/>
									</div>
								</div>
							</div>
						);
					case Action.EDITOR:
						return <div>Editor: {item.action}</div>;
					case Action.LOOP:
						return <div>Loop: {item.times}</div>;
				}
			})}

			<div className="setting-item cmdr-mm-actions cmdr-justify-between">
				<div className="cmdr-flex cmdr-items-center cmdr-justify-self-start">
					<input
						type="checkbox"
						id="checkbox"
						checked={startup}
						onChange={({ target }): void => {
							//@ts-expect-error
							setStartup(target?.checked ?? false);
						}}
					/>
					<label htmlFor="checkbox">Auto-Run on Startup</label>
				</div>
				<div>
					<button onClick={handleAddCommand}>Add Command</button>
					<button onClick={handleAddDelay}>Add Delay</button>
				</div>
				{/* <button>Add Editor Command</button>
			<button>Add loop</button> */}
			</div>

			<div className="cmdr-mm-control">
				<button
					class={macroCommands.length === 0 ? "disabled" : "mod-cta"}
					disabled={macroCommands.length === 0}
					onClick={(): boolean | void =>
						macroCommands.length &&
						onSave({ macro: macroCommands, name, icon, startup })
					}
				>
					Save
				</button>
				<button onClick={onCancel}>Cancel</button>
			</div>
		</div>
	);
}
