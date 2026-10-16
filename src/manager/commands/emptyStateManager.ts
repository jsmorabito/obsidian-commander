import { Platform, setIcon, View } from "obsidian";
import t from "src/l10n";
import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import { showCommandContextMenu } from "src/ui/commandContextMenu";
import { chooseNewCommand, isModeActive } from "src/util";
import CommandManagerBase from "./commandManager";

const BUTTON_CLASS = "cmdr-empty-state";
const EMPTY_VIEW_TYPE = "empty";

/** Same DOM as Obsidian's (internal) text-icon buttons, so themes apply. */
function createPill(
	list: HTMLElement,
	icon: string,
	text: string,
	onClick: (event: MouseEvent | KeyboardEvent) => unknown
): HTMLElement {
	const buttonEl = list.createDiv({
		cls: `text-icon-button tappable mod-pill empty-state-action ${BUTTON_CLASS}`,
		attr: { tabIndex: 0, role: "button" },
	});
	setIcon(buttonEl.createSpan("text-button-icon"), icon);
	buttonEl.createSpan({ cls: "text-button-label", text });
	buttonEl.addEventListener("click", onClick);
	buttonEl.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onClick(event);
		}
	});
	return buttonEl;
}

/** Obsidian shows hotkeys on its own pills only when a keyboard is attached. */
function hasPhysicalKeyboard(): boolean {
	return (
		(Platform as { hasPhysicalKeyboard?: boolean }).hasPhysicalKeyboard ??
		!Platform.isMobile
	);
}

/**
 * Adds command buttons to the "New tab" empty state, below Obsidian's own
 * (New note, Go to file, ...). The view empties and rebuilds its action list
 * in `onOpen()`, so `View.prototype.open` is wrapped to add our buttons right
 * after it, for new tabs and for deferred tabs loading on first focus alike.
 */
export default class EmptyStateManager extends CommandManagerBase {
	public constructor(plugin: CommanderPlugin, pairArray: CommandIconPair[]) {
		super(plugin, pairArray);
		this.init();
	}

	private init(): void {
		this.patchViewOpen();
		this.plugin.register(() => this.removeButtons());
		// Hotkeys can change while a tab is open; refresh when one is focused.
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view.getViewType() === EMPTY_VIEW_TYPE)
					this.render(leaf.view);
			})
		);
		// Tabs opened before the plugin loaded.
		this.plugin.app.workspace.onLayoutReady(() => this.reorder());
	}

	private patchViewOpen(): void {
		// eslint-disable-next-line @typescript-eslint/unbound-method -- re-bound via .call below
		const original = View.prototype.open;
		let active = true;
		const render = (view: View): void => this.render(view);
		const patched = async function (
			this: View,
			containerEl: HTMLElement
		): Promise<void> {
			await original.call(this, containerEl);
			if (active && this.getViewType() === EMPTY_VIEW_TYPE)
				render(this);
		};
		View.prototype.open = patched;
		this.plugin.register(() => {
			active = false;
			// Leave a later plugin's wrapper in place; ours is inert now.
			if (View.prototype.open === patched) View.prototype.open = original;
		});
	}

	private emptyViews(): View[] {
		return this.plugin.app.workspace
			.getLeavesOfType(EMPTY_VIEW_TYPE)
			.map((leaf) => leaf.view);
	}

	private render(view: View): void {
		// Deferred (not yet loaded) tabs have no action list.
		const list = view.containerEl.querySelector<HTMLElement>(
			".empty-state-action-list"
		);
		if (!list) return;
		this.removeButtonsFrom(list);
		for (const pair of this.pairs) {
			if (isModeActive(pair.mode, this.plugin)) this.addButton(list, pair);
		}
		if (this.plugin.settings.showAddCommand) {
			createPill(list, "plus", t("Add new"), async () => {
				await this.addCommand(await chooseNewCommand(this.plugin));
			});
		}
	}

	private addButton(list: HTMLElement, pair: CommandIconPair): void {
		const buttonEl = createPill(list, pair.icon, pair.name, (event) =>
			this.plugin.app.commands.executeCommandById(pair.id, event)
		);
		if (pair.color && pair.color !== "#000000")
			buttonEl.style.color = pair.color;

		// Mirror Obsidian's own buttons, which show their hotkey.
		if (hasPhysicalKeyboard()) {
			const hotkey =
				this.plugin.app.hotkeyManager?.printHotkeyForCommand(pair.id);
			if (hotkey)
				buttonEl.createSpan({
					cls: "empty-state-hotkey",
					text: " " + hotkey,
				});
		}

		buttonEl.addEventListener("contextmenu", (event) => {
			event.stopImmediatePropagation();
			showCommandContextMenu(this.plugin, this, pair, event);
		});
	}

	private removeButtonsFrom(list: HTMLElement): void {
		list.querySelectorAll(`.${BUTTON_CLASS}`).forEach((el) => el.remove());
	}

	private removeButtons(): void {
		for (const view of this.emptyViews()) {
			view.containerEl
				.querySelectorAll(`.${BUTTON_CLASS}`)
				.forEach((el) => el.remove());
		}
	}

	public reorder(): void {
		for (const view of this.emptyViews()) this.render(view);
	}

	public async addCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.push(pair);
		this.reorder();
		await this.plugin.saveSettings();
	}

	public async removeCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.remove(pair);
		this.reorder();
		await this.plugin.saveSettings();
	}
}
