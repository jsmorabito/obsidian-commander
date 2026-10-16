import { setIcon, WorkspaceLeaf } from "obsidian";
import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import ConfirmDeleteModal from "src/ui/confirmDeleteModal";
import { isModeActive } from "src/util";
import { showCommandContextMenu } from "src/ui/commandContextMenu";
import CommandManagerBase from "./commandManager";

export default class ExplorerManager extends CommandManagerBase {
	private readonly actions = new Map<CommandIconPair, HTMLElement>();

	public constructor(plugin: CommanderPlugin, pairs: CommandIconPair[]) {
		super(plugin, pairs);
		this.init();
		this.plugin.register(() =>
			this.actions.forEach((_, key) => this.removeAction(key))
		);
	}

	private getFileExplorers(): WorkspaceLeaf[] {
		return this.plugin.app.workspace.getLeavesOfType("file-explorer");
	}

	private init(): void {
		this.plugin.app.workspace.onLayoutReady(() => {
			for (const cmd of this.pairs) {
				if (isModeActive(cmd.mode, this.plugin)) {
					this.plugin.app.workspace.onLayoutReady(() => {
						const explorers = this.getFileExplorers();
						explorers.forEach((exp) => {
							this.addAction(cmd, exp);
						});
					});

					// File explorers that get opened later on
					this.plugin.registerEvent(
						this.plugin.app.workspace.on("layout-change", () => {
							const explorers = this.getFileExplorers();
							explorers.forEach((exp) => {
								this.addAction(cmd, exp);
							});
						})
					);
				}
			}
		});
	}

	public reorder(): void {
		this.actions.forEach((_, key) => this.removeAction(key, true));
		this.init();
	}

	public async addCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.push(pair);
		this.plugin.app.workspace.onLayoutReady(() => {
			const explorers = this.getFileExplorers();
			explorers.forEach((exp) => {
				this.addAction(pair, exp);
			});
		});

		// File explorers that get opened later on
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("layout-change", () => {
				const explorers = this.getFileExplorers();
				explorers.forEach((exp) => {
					this.addAction(pair, exp);
				});
			})
		);
		await this.plugin.saveSettings();
	}

	public async removeCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.remove(pair);
		this.removeAction(pair);
		await this.plugin.saveSettings();
	}

	private buttonExists(leaf: WorkspaceLeaf, action: CommandIconPair): boolean {
		return [
			...leaf.view.containerEl.querySelectorAll(
				"div.nav-buttons-container > .cmdr.clickable-icon"
			),
		].some(
			(element) =>
				element.getAttribute("data-cmdr") === action.icon + action.name
		);
	}

	private addAction(pair: CommandIconPair, leaf: WorkspaceLeaf): void {
		if (this.buttonExists(leaf, pair)) {
			return;
		}

		const btn = createDiv({
			cls: "cmdr clickable-icon",
			attr: {
				"aria-label-position": "top",
				"aria-label": pair.name,
				"data-cmdr": pair.icon + pair.name,
			},
		});
		this.actions.set(pair, btn);
		btn.style.color =
			pair.color === "#000000" || pair.color === undefined
				? "inherit"
				: pair.color;

		let isRemovable = false;

		const setNormal = (): void => {
			btn.empty();
			setIcon(btn, pair.icon);
			btn.onclick = (): void =>
				this.plugin.app.commands.executeCommandById(pair.id);
		};
		const setRemovable = (): void => {
			btn.empty();
			setIcon(btn, "trash");
			btn.onclick = async (): Promise<void> => {
				if (
					!this.plugin.settings.confirmDeletion ||
					(await new ConfirmDeleteModal(
						this.plugin
					).didChooseRemove())
				) {
					await this.removeCommand(pair);
				}
			};
		};

		btn.addEventListener("mouseleave", () => {
			setNormal();
			isRemovable = false;
		});
		btn.addEventListener("mousemove", (event) => {
			event.preventDefault();
			event.stopImmediatePropagation();
			if (event.shiftKey) {
				if (!isRemovable) setRemovable();
				isRemovable = true;
			}
		});
		btn.addEventListener("contextmenu", (event) => {
			event.stopImmediatePropagation();
			showCommandContextMenu(this.plugin, this, pair, event);
		});

		setNormal();
		leaf.view?.containerEl
			?.querySelector?.("div.nav-buttons-container")
			?.appendChild?.(btn);
	}

	private removeAction(pair: CommandIconPair, instant = false): void {
		const action = this.actions.get(pair);
		if (!action) return;

		if (instant) {
			action.remove();
			this.actions.delete(pair);
			return;
		}

		action.addClass("cmdr-ribbon-removing");
		action.addEventListener("transitionend", () => {
			action.remove();
			this.actions.delete(pair);
		});
	}
}
