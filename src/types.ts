import { h } from "preact";
import { Command, PluginManifest } from "obsidian";

export enum Action {
	COMMAND,
	DELAY,
	EDITOR,
	LOOP,
}

export type MacroItem =
	| { action: Action.COMMAND; commandId: string }
	| { action: Action.DELAY; delay: number }
	| { action: Action.EDITOR }
	| { action: Action.LOOP; times: number; commandId: string };

export interface Macro {
	name: string;
	icon: string;
	startup?: boolean;
	macro: MacroItem[];
}

export interface CommanderSettings {
	confirmDeletion: boolean;
	showAddCommand: boolean;
	debug: boolean;
	editorMenu: CommandIconPair[];
	fileMenu: CommandIconPair[];
	leftRibbon: CommandIconPair[];
	rightRibbon: CommandIconPair[];
	titleBar: CommandIconPair[];
	statusBar: CommandIconPair[];
	pageHeader: CommandIconPair[];
	explorer: CommandIconPair[];
	macros: Macro[];
	textToolbarCommands: CommandIconPair[];
	hide: {
		statusbar: string[];
		leftRibbon: string[];
		/** Titles/regexes removed from the editor right-click menu. */
		editorMenuItems: string[];
		/** Titles/regexes removed from the file right-click menu. */
		fileMenuItems: string[];
		/** Menu-item titles observed in editor menus, for the settings checklist. */
		seenEditorMenuItems: string[];
		/** Menu-item titles observed in file menus, for the settings checklist. */
		seenFileMenuItems: string[];
	};
	spacing: number;
	/**
	 * Set once the one-time `spacing: 8` -> `0` migration has run. The old
	 * default of 8 silently widened *all* toolbar icons (Obsidian's included);
	 * this flag stops the migration from re-running if a user deliberately
	 * sets 8 again. TODO: remove this in a future version.
	 */
	spacingReset?: boolean;
	advancedToolbar: AdvancedToolbarSettings;
}

export interface AdvancedToolbarSettings {
	rowHeight: number;
	rowCount: number;
	spacing: number;
	buttonWidth: number;
	columnLayout: boolean;
	mappedIcons: {
		iconID: string;
		commandID: string;
	}[];
	tooltips: boolean;
	heightOffset: number;
}

export interface Tab {
	name: string;
	tab: h.JSX.Element;
}

export type Mode = "desktop" | "any" | "mobile" | (string & {});

export interface CommandIconPair {
	id: string;
	icon: string;
	name: string;
	mode: Mode;
	color?: string;
}

declare module "obsidian" {
	interface MenuItem {
		dom: HTMLElement;
		titleEl?: HTMLElement;
	}

	interface Menu {
		/** Internal list of items/separators, in render order. */
		items?: unknown[];
		/** Set on submenus; points at the parent Menu. */
		parentMenu?: Menu | null;
	}

	interface App {
		commands: {
			commands: {
				[id: string]: Command;
			};
			executeCommandById: (id: string) => void;
			removeCommand: (id: string) => void;
		};
		plugins: {
			manifests: {
				[id: string]: PluginManifest;
			};
		};
		statusBar: {
			containerEl: HTMLElement;
		};
		appId: string;
		isMobile: boolean;
		setting: {
			closeActiveTab: () => void;
			openTabById: (id: string) => void;
			activeTab: {
				containerEl: HTMLElement;
			};
		};
	}

	interface WorkspaceRibbon {
		orderedRibbonActions: {
			icon: string;
			title: string;
			callback: () => void;
		}[];
		items: {
			icon: string;
			title: string;
			buttonEl: HTMLElement;
		}[];
		collapseButtonEl: HTMLElement;
		ribbonItemsEl: HTMLElement;
		addRibbonItemButton: (
			icon: string,
			name: string,
			callback: (event: MouseEvent) => void
		) => void;
		makeRibbonItemButton: (
			icon: string,
			name: string,
			callback: (event: MouseEvent) => void
		) => HTMLElement;
	}

	interface WorkspaceLeaf {
		containerEl: HTMLElement;
	}

	interface Vault {
		getConfig(key: string): unknown;
	}
}
