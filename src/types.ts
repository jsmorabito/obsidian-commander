import { h } from "preact";

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
	};
	spacing: number;
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

export type Mode = "desktop" | "any" | "mobile" | string;

export interface CommandIconPair {
	id: string;
	icon: string;
	name: string;
	mode: Mode;
	color?: string;
}

/* eslint-disable no-unused-vars */
declare module "obsidian" {
	interface MenuItem {
		dom: HTMLElement;
	}

	interface App {
		commands: {
			commands: {
				[id: string]: Command;
			};
			executeCommandById: (id: string) => void;
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
}
