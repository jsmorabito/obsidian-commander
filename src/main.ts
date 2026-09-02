import {
	injectIcons,
	removeStyles,
	updateMacroCommands,
	updateStyles,
} from "src/util";
import { updateSpacing } from "src/util";
import { Command, Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "./constants";
import t from "./l10n";
import {
	EditorMenuCommandManager,
	ExplorerManager,
	FileMenuCommandManager,
	PageHeaderManager,
	StatusBarManager,
	TextToolbarIntegrationManager,
} from "./manager/commands";
import { Action, CommanderSettings } from "./types";
import CommanderSettingTab from "./ui/settingTab";
import SettingTabModal from "./ui/settingTabModal";

import "./styles/styles.scss";
import "./styles/advanced-toolbar.scss";
import { updateHiderStylesheet } from "./util";
import registerCustomIcons from "./ui/icons";
import LeftRibbonManager from "./manager/commands/leftRibbonManager";
import MenuHiderManager from "./manager/menuHiderManager";

export default class CommanderPlugin extends Plugin {
	public settings: CommanderSettings;
	public manager: {
		editorMenu: EditorMenuCommandManager;
		fileMenu: FileMenuCommandManager;
		leftRibbon: LeftRibbonManager;
		//rightRibbon: RibbonManager,
		//titleBar: TitleBarManager,
		statusBar: StatusBarManager;
		pageHeader: PageHeaderManager;
		explorerManager: ExplorerManager;
		textToolbarIntegration: TextToolbarIntegrationManager;
		menuHider: MenuHiderManager;
	};

	public async executeStartupMacros(): Promise<void> {
		this.settings.macros.forEach((macro, idx) => {
			if (macro.startup) {
				void this.executeMacro(idx);
			}
		});
	}

	public async executeMacro(id: number): Promise<void> {
		const macro = this.settings.macros[id];
		if (!macro) throw new Error("Macro not found");

		for (const command of macro.macro) {
			switch (command.action) {
				case Action.COMMAND: {
					this.app.commands.executeCommandById(command.commandId);
					continue;
				}
				case Action.DELAY: {
					await new Promise((resolve) =>
						window.setTimeout(resolve, command.delay)
					);
					continue;
				}
				case Action.EDITOR: {
					continue;
				}
				case Action.LOOP: {
					for (let i = 0; i < command.times; i++) {
						this.app.commands.executeCommandById(
							command.commandId
						);
					}
					continue;
				}
			}
		}
	}

	public async onload(): Promise<void> {
		await this.loadSettings();
		this.settings.hide.leftRibbon ??= []; // TODO: remove this in a future version
		this.settings.hide.editorMenuItems ??= []; // TODO: remove this in a future version
		this.settings.hide.fileMenuItems ??= []; // TODO: remove this in a future version
		this.settings.hide.seenEditorMenuItems ??= []; // TODO: remove this in a future version
		this.settings.hide.seenFileMenuItems ??= []; // TODO: remove this in a future version

		registerCustomIcons();

		this.manager = {
			editorMenu: new EditorMenuCommandManager(
				this,
				this.settings.editorMenu
			),
			fileMenu: new FileMenuCommandManager(this, this.settings.fileMenu),
			leftRibbon: new LeftRibbonManager(this),
			//rightRibbon: new RibbonManager("right", this),
			//titleBar: new TitleBarManager(this, this.settings.titleBar),
			statusBar: new StatusBarManager(this, this.settings.statusBar),
			pageHeader: new PageHeaderManager(this, this.settings.pageHeader),
			explorerManager: new ExplorerManager(this, this.settings.explorer),
			textToolbarIntegration: new TextToolbarIntegrationManager(this, this.settings.textToolbarCommands),
			menuHider: new MenuHiderManager(this),
		};

		this.addSettingTab(new CommanderSettingTab(this));

		this.addCommand({
			name: t("Open Commander Settings"),
			id: "open-commander-settings",
			callback: () => new SettingTabModal(this).open(),
		});

		const applyEditorMenu =
			this.manager.editorMenu.applyEditorMenuCommands(this);
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, info) => {
				// Tag the menu so MenuHiderManager knows which hide list applies
				// (including submenus, via the parentMenu walk).
				this.manager.menuHider.tag(menu, "editorMenuItems");
				return applyEditorMenu(menu, editor, info);
			})
		);

		const applyFileMenu = this.manager.fileMenu.applyFileMenuCommands(this);
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				this.manager.menuHider.tag(menu, "fileMenuItems");
				return applyFileMenu(menu, file, source, leaf);
			})
		);

		this.app.workspace.onLayoutReady(() => {
			updateHiderStylesheet(this.settings);
			updateMacroCommands(this);
			updateSpacing(this.settings.spacing);
			updateStyles(this.settings.advancedToolbar);
			injectIcons(this.settings.advancedToolbar, this);

			void this.executeStartupMacros();

			// Push saved commands into the Text Toolbar plugin if it is installed
			this.manager.textToolbarIntegration.reorder();
		});
	}

	public onunload(): void {
		document.head.querySelector("style#cmdr")?.remove();
		removeStyles();
	}

	private async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as unknown;
		// loadData() can return null (no file) or a partially written / corrupt
		// object (e.g. an interrupted sync). Reject non-objects at every level and
		// deep-merge the nested groups, so a malformed value falls back to
		// defaults for that group only instead of wiping the user's buttons.
		const isObject = (v: unknown): boolean =>
			!!v && typeof v === "object" && !Array.isArray(v);

		const data = (
			isObject(loaded) ? loaded : {}
		) as Partial<CommanderSettings>;
		const hide = isObject(data.hide) ? data.hide : undefined;
		const advancedToolbar = isObject(data.advancedToolbar)
			? data.advancedToolbar
			: undefined;

		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
			hide: { ...DEFAULT_SETTINGS.hide, ...hide },
			advancedToolbar: {
				...DEFAULT_SETTINGS.advancedToolbar,
				...advancedToolbar,
			},
		};

		// One-time migration (TODO: remove in a future version). The old default
		// `spacing: 8` applied `margin-right: 8px` to every toolbar icon,
		// Obsidian's own included — a regression from the native baseline. Reset a
		// persisted 8 back to 0 once; `spacingReset` guards re-runs so a
		// deliberate re-set to 8 sticks. A fresh vault has nothing to migrate, so
		// it records the flag in memory without writing to disk.
		if (this.settings.spacingReset === undefined) {
			if (this.settings.spacing === 8) this.settings.spacing = 0;
			this.settings.spacingReset = true;
			if (isObject(loaded)) {
				try {
					await this.saveSettings();
				} catch (e) {
					console.error(
						"Commander: could not persist spacing migration",
						e
					);
				}
			}
		}
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	public listActiveToolbarCommands(): string[] {
		return this.app.vault.getConfig("mobileToolbarCommands") as string[];
	}

	public getCommands(): Command[] {
		const commands: Command[] = [];
		this.listActiveToolbarCommands().forEach((id) => {
			//@ts-ignore
			const c = this.app.commands.commands[id];
			if (c) commands.push(c);
		});
		return commands;
	}

	public getCommandsWithoutIcons(includeSelfAdded = true): Command[] {
		const commands: Command[] = [];
		this.getCommands().forEach((c) => {
			if (c && !c.icon) {
				commands.push(c);
			}
		});
		if (includeSelfAdded) {
			this.getCommands().forEach((c) => {
				if (
					this.settings.advancedToolbar.mappedIcons.find(
						(m) => m.commandID === c.id
					)
				) {
					commands.push(c);
				}
			});
		}
		return commands;
	}
}
