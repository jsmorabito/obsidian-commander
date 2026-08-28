import { SuggestModal } from "obsidian";
import t from "src/l10n";
import CommanderPlugin from "src/main";

export default class ChooseCustomNameModal extends SuggestModal<string> {
	public constructor(
		private defaultName: string,
		private plugin: CommanderPlugin
	) {
		super(plugin.app);
		this.setPlaceholder(t("Use a custom name"));
		this.resultContainerEl.addClass("cmdr-hide-suggestions");

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
		void super.onOpen();

		this.inputEl.value = this.defaultName;

		const inputContainer = this.inputEl.parentElement;
		const wrapper = createDiv({ cls: "cmdr-name-input-wrapper" });
		inputContainer?.insertBefore(wrapper, this.inputEl);

		// Keep the input and Obsidian's native clear button together in their own
		// positioned field, so the absolutely-positioned clear button stays pinned
		// to the input instead of overlapping the Save button (especially on mobile).
		const field = wrapper.createDiv({ cls: "cmdr-name-input-field" });
		field.appendChild(this.inputEl);
		const clearButton = inputContainer?.querySelector(
			".search-input-clear-button"
		);
		if (clearButton) field.appendChild(clearButton);

		inputContainer?.addClass("cmdr-name-input-wrapper-parent");

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
				window.setTimeout(() => reject(new Error("No Name selected")), 0);
		});
	}

	public getSuggestions(query: string): string[] | Promise<string[]> {
		return [query];
	}

	// This isn't needed, since we just want a text field without options
	// eslint-disable-next-line @typescript-eslint/no-empty-function -- intentionally a no-op, only a text field is needed
	public renderSuggestion(value: string, el: HTMLElement): void {}

	// This will be overriden anyway, but typescript complains if it's not declared
	/* eslint-disable @typescript-eslint/no-empty-function -- overridden by awaitSelection, declared only to satisfy the type */
	public onChooseSuggestion(
		item: string,
		evt: MouseEvent | KeyboardEvent
	): void {}
	/* eslint-enable @typescript-eslint/no-empty-function -- overridden by awaitSelection, declared only to satisfy the type */
}
