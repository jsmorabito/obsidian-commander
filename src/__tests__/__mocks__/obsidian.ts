// Minimal Obsidian API mock for unit tests

// moment is a global in Obsidian; provide a minimal stub
(globalThis as Record<string, unknown>).moment = { locale: (): string => "en" };

export const Platform = {
	isDesktop: true,
	isMobile: false,
};

export function setIcon(el: HTMLElement, icon: string): void {
	el.setAttribute("data-icon", icon);
}

export function requireApiVersion(_version: string): boolean {
	return true;
}

export function getIconIds(): string[] {
	return ["check", "x", "star", "home"];
}

export class Plugin {}
export class Modal {}
export class Setting {}
export class FuzzySuggestModal<T> {
	public app: unknown;
	protected declare items: T[];
	public constructor(app: unknown) { this.app = app; }
	// eslint-disable-next-line @typescript-eslint/no-empty-function -- minimal test double, no-op is intentional
	public open(): void {}
	// eslint-disable-next-line @typescript-eslint/no-empty-function -- minimal test double, no-op is intentional
	public close(): void {}
}
export class SuggestModal<T> {
	public app: unknown;
	protected declare items: T[];
	public constructor(app: unknown) { this.app = app; }
	// eslint-disable-next-line @typescript-eslint/no-empty-function -- minimal test double, no-op is intentional
	public open(): void {}
	// eslint-disable-next-line @typescript-eslint/no-empty-function -- minimal test double, no-op is intentional
	public close(): void {}
}
export class PluginSettingTab {
	public app: unknown;
	public plugin: unknown;
	public containerEl: HTMLElement = document.createElement("div");
	public constructor(app: unknown, plugin: unknown) { this.app = app; this.plugin = plugin; }
}

export class Menu {
	// eslint-disable-next-line @typescript-eslint/no-empty-function -- test double
	public showAtMouseEvent(): void {}
	// eslint-disable-next-line @typescript-eslint/no-empty-function -- test double
	public showAtPosition(): void {}
}
export class MenuItem {
	// eslint-disable-next-line @typescript-eslint/no-empty-function -- test double
	public setTitle(): void {}
}
export class MarkdownView {}
