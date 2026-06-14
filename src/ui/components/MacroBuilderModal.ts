import { Modal } from "obsidian";
import { h, render } from "preact";
import CommanderPlugin from "src/main";
import { Macro } from "src/types";
import MacroBuilderComponent from "./MacroBuilder";

export default class MacroBuilderModal extends Modal {
	private plugin: CommanderPlugin;
	private macro: Macro;
	// eslint-disable-next-line no-unused-vars
	private onSave: (_macro: Macro) => void;

	public constructor(
		plugin: CommanderPlugin,
		// eslint-disable-next-line no-unused-vars
		macro: Macro,
		// eslint-disable-next-line no-unused-vars
		onSave: (_macro: Macro) => void
	) {
		super(plugin.app);
		this.macro = macro;
		this.plugin = plugin;
		this.onSave = onSave;
	}

	public onOpen(): void {
		this.titleEl.setText("Macro Builder");
		render(
			h(MacroBuilderComponent, {
				plugin: this.plugin,
				macro: this.macro,
				onSave: this.onSave,
				onCancel: this.close.bind(this),
			}),
			this.contentEl
		);
	}

	public onClose(): void {
		render(null, this.contentEl);
	}
}
