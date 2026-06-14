import { SuggestModal } from "obsidian";
import t from "src/l10n";
import CommanderPlugin from "src/main";

export default class ChooseCustomNameModal extends SuggestModal<string> {
	public constructor(
		// eslint-disable-next-line no-unused-vars
		private defaultName: string,
		// eslint-disable-next-line no-unused-vars
		private plugin: CommanderPlugin
	) {
		super(plugin.app);
		this.setPlaceholder(t("Use a custom name"));
		this.resultContainerEl.style.display = "none";

		this.setInstructions([
			{
				command: "",
				purpose: t("Choose a custom Name for your new Command"),
			},
			{
				command: "↵",
				purpose: t("to save"),
			},
			{
				command: "esc",
				purpose: t("to cancel"),
			},
		]);
	}

	public onOpen(): void {
		super.onOpen();

		this.inputEl.value = this.defaultName;
		const wrapper = createDiv({ cls: "cmdr-name-input-wrapper" });
		this.inputEl.parentNode?.insertBefore(wrapper, this.inputEl);
		wrapper.appendChild(this.inputEl);
		wrapper.parentElement!.style.display = "block";

		const btn = createEl("button", { text: t("Save"), cls: "mod-cta" });
		btn.onclick = (e): void => this.selectSuggestion(this.inputEl.value, e);
		wrapper.appendChild(btn);
	}

	public async awaitSelection(): Promise<string> {
		this.open();
		return new Promise((resolve, reject) => {
			this.onChooseSuggestion = (item): void => resolve(item);
			//This is wrapped inside a setTimeout, because onClose is called before onChooseItem
			this.onClose = (): number =>
				window.setTimeout(() => reject("No Name selected"), 0);
		});
	}

	public getSuggestions(query: string): string[] | Promise<string[]> {
		return [query];
	}

	// This isn't needed, since we just want a text field without options
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-empty-function
	public renderSuggestion(value: string, el: HTMLElement): void {}

	// This will be overriden anyway, but typescript complains if it's not declared
	/* eslint-disable no-unused-vars, @typescript-eslint/no-empty-function */
	public onChooseSuggestion(
		item: string,
		evt: MouseEvent | KeyboardEvent
	): void {}
	/* eslint-enable no-unused-vars, @typescript-eslint/no-empty-function */
}
