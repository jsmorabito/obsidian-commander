import { Menu, MenuItem } from "obsidian";
import CommanderPlugin from "src/main";

/**
 * Hides items from right-click context menus by their visible label.
 *
 * Ported from Mara-Li's "Context Command Hider"
 * (https://github.com/Mara-Li/obsidian-context-menu-hider), MIT.
 *
 * That plugin CSS-hides the rendered menu DOM node, which is why it requires
 * Obsidian's Appearance → "Native menus" option to be turned off. This
 * implementation instead splices the matched items out of `menu.items` before
 * the menu is shown, so it works with native menus on or off.
 *
 * The settings checklist is populated by recording the item titles of every
 * real menu that opens (`hide.seen*MenuItems`).
 */

export type MenuScope = "editorMenuItems" | "fileMenuItems";

export interface Matcher {
	/** The raw entry as typed by the user. */
	source: string;
	test(title: string): boolean;
}

const SLASH_WRAPPED = /^\/(.*)\/([dgimsuy]*)$/;

/** Most titles seen in one menu scope that we keep persisted. */
const SEEN_CAP = 250;

/** True when `entry` is written as a `/…/flags` regex literal. */
export function isSlashWrapped(entry: string): boolean {
	return SLASH_WRAPPED.test(entry.trim());
}

/**
 * True when `entry` is a regex literal that is unusable: an empty body (`//`,
 * which would match every menu item) or one that does not compile.
 */
export function isInvalidPattern(entry: string): boolean {
	const m = entry.trim().match(SLASH_WRAPPED);
	if (!m) return false;
	if (m[1] === "") return true;
	try {
		new RegExp(m[1], m[2]);
		return false;
	} catch {
		return true;
	}
}

/**
 * Compile a list of user entries into matchers. An entry wrapped in slashes
 * (`/foo/i`) is a regular expression; anything else is an exact,
 * case-insensitive string match. Blank entries, empty-body regexes, and
 * uncompilable regexes are dropped.
 */
export function compileMatchers(patterns: string[]): Matcher[] {
	const matchers: Matcher[] = [];
	for (const raw of patterns) {
		const source = raw.trim();
		if (!source) continue;

		const rx = source.match(SLASH_WRAPPED);
		if (rx) {
			// Skip an empty body: `new RegExp("")` matches everything and would
			// silently wipe the whole menu. The settings UI flags it too.
			if (rx[1] === "") continue;
			try {
				const re = new RegExp(rx[1], rx[2]);
				matchers.push({ source, test: (title) => re.test(title) });
			} catch {
				// Invalid regex: skip it. The settings UI flags it for the user.
			}
			continue;
		}

		const lower = source.toLowerCase();
		matchers.push({
			source,
			test: (title) => title.toLowerCase() === lower,
		});
	}
	return matchers;
}

export function titleMatches(title: string, matchers: Matcher[]): boolean {
	if (!title) return false;
	for (const m of matchers) {
		if (m.test(title)) return true;
	}
	return false;
}

type TaggedMenu = Menu & {
	__cmdrMenuScope?: MenuScope;
	__cmdrMenuFiltered?: boolean;
};
type StampedItem = MenuItem & {
	__cmdrMenuItemTitle?: string;
};

function isMenuItem(x: unknown): x is MenuItem {
	return !!x && typeof (x as MenuItem).setTitle === "function";
}

const SEEN_KEY: Record<MenuScope, "seenEditorMenuItems" | "seenFileMenuItems"> = {
	editorMenuItems: "seenEditorMenuItems",
	fileMenuItems: "seenFileMenuItems",
};

export default class MenuHiderManager {
	private readonly plugin: CommanderPlugin;
	private matchers: Record<MenuScope, Matcher[]> = {
		editorMenuItems: [],
		fileMenuItems: [],
	};
	private readonly changeListeners = new Set<() => void>();
	private saveTimer: number | null = null;

	public constructor(plugin: CommanderPlugin) {
		this.plugin = plugin;
		this.recompile();
		this.patch();
		this.plugin.register(() => this.flushSave());
	}

	/** Rebuild the compiled matcher lists. Call after settings change. */
	public recompile(): void {
		this.matchers.editorMenuItems = compileMatchers(
			this.plugin.settings.hide.editorMenuItems
		);
		this.matchers.fileMenuItems = compileMatchers(
			this.plugin.settings.hide.fileMenuItems
		);
	}

	/**
	 * Mark a menu as belonging to a scope. Called from the `editor-menu` /
	 * `file-menu` workspace events, which hand us the menu before it is shown.
	 */
	public tag(menu: Menu, scope: MenuScope): void {
		(menu as TaggedMenu).__cmdrMenuScope = scope;
	}

	/** Persisted list of titles ever seen in this menu scope, sorted. */
	public getSeen(scope: MenuScope): string[] {
		return [...this.plugin.settings.hide[SEEN_KEY[scope]]].sort((a, b) =>
			a.localeCompare(b)
		);
	}

	/** Subscribe to seen-list changes; returns an unsubscribe function. */
	public onChange(cb: () => void): () => void {
		this.changeListeners.add(cb);
		return () => {
			this.changeListeners.delete(cb);
		};
	}

	private emitChange(): void {
		for (const cb of this.changeListeners) {
			try {
				cb();
			} catch (e) {
				console.error("[cmdr] menu hider listener failed:", e);
			}
		}
	}

	private itemTitles(menu: Menu): string[] {
		const titles: string[] = [];
		for (const item of menu.items ?? []) {
			if (!isMenuItem(item)) continue;
			const title = this.titleOf(item).trim();
			if (title) titles.push(title);
		}
		return titles;
	}

	private recordSeen(scope: MenuScope, titles: string[]): void {
		if (titles.length === 0) return;
		const list = this.plugin.settings.hide[SEEN_KEY[scope]];
		let added = false;
		for (const title of titles) {
			if (!list.includes(title)) {
				list.push(title);
				added = true;
			}
		}
		if (!added) return;
		if (list.length > SEEN_CAP) list.splice(0, list.length - SEEN_CAP);
		this.scheduleSave();
		this.emitChange();
	}

	private scheduleSave(): void {
		if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.plugin.saveSettings();
		}, 800);
	}

	private flushSave(): void {
		if (this.saveTimer === null) return;
		window.clearTimeout(this.saveTimer);
		this.saveTimer = null;
		void this.plugin.saveSettings();
	}

	/** Walk up the submenu chain to the nearest tagged ancestor. */
	private resolveScope(menu: Menu): MenuScope | null {
		let current: Menu | null | undefined = menu;
		for (let hops = 0; current && hops < 32; hops++) {
			const scope = (current as TaggedMenu).__cmdrMenuScope;
			if (scope) return scope;
			current = current.parentMenu ?? null;
		}
		return null;
	}

	private titleOf(item: MenuItem): string {
		const stamped = (item as StampedItem).__cmdrMenuItemTitle;
		if (typeof stamped === "string" && stamped) return stamped;
		if (item.titleEl?.textContent) return item.titleEl.textContent;
		const dom = item.dom;
		return (
			dom?.querySelector(".menu-item-title")?.textContent ??
			dom?.textContent ??
			""
		);
	}

	/** Runs on every real menu show: record its items, then hide matches. */
	private handleShow(menu: Menu): void {
		const tagged = menu as TaggedMenu;
		if (tagged.__cmdrMenuFiltered) return;

		const scope = this.resolveScope(menu);
		if (!scope) return;
		tagged.__cmdrMenuFiltered = true;

		const items = menu.items;
		if (!items) return;

		this.recordSeen(scope, this.itemTitles(menu));

		const matchers = this.matchers[scope];
		if (matchers.length === 0) return;

		let changed = false;
		for (let i = items.length - 1; i >= 0; i--) {
			const item = items[i];
			if (!isMenuItem(item)) continue; // separator
			if (titleMatches(this.titleOf(item).trim(), matchers)) {
				items.splice(i, 1);
				changed = true;
			}
		}

		if (changed) this.collapseSeparators(items);
	}

	/** Drop separators left leading, trailing, or doubled by a removal. */
	private collapseSeparators(items: unknown[]): void {
		for (let i = items.length - 1; i >= 0; i--) {
			if (isMenuItem(items[i])) continue;
			const isLeading = i === 0;
			const isTrailing = i === items.length - 1;
			const prevIsSeparator = i > 0 && !isMenuItem(items[i - 1]);
			if (isLeading || isTrailing || prevIsSeparator) {
				items.splice(i, 1);
			}
		}
	}

	private patch(): void {
		const onShow = (menu: Menu): void => {
			try {
				this.handleShow(menu);
			} catch (e) {
				console.error("[cmdr] menu hider failed:", e);
			}
		};

		const menuProto = Menu.prototype as unknown as {
			showAtMouseEvent: (this: Menu, evt: MouseEvent) => unknown;
			showAtPosition: (
				this: Menu,
				position: unknown,
				doc?: Document
			) => unknown;
		};
		const itemProto = MenuItem.prototype as unknown as {
			setTitle: (
				this: StampedItem,
				title: string | DocumentFragment
			) => unknown;
		};

		const originalSetTitle = itemProto.setTitle;
		itemProto.setTitle = function (
			this: StampedItem,
			title: string | DocumentFragment
		): unknown {
			try {
				this.__cmdrMenuItemTitle =
					typeof title === "string"
						? title
						: (title.textContent ?? "");
			} catch {
				// Never let the stamp break menu construction.
			}
			return originalSetTitle.call(this, title);
		};

		const originalMouse = menuProto.showAtMouseEvent;
		menuProto.showAtMouseEvent = function (
			this: Menu,
			evt: MouseEvent
		): unknown {
			onShow(this);
			return originalMouse.call(this, evt);
		};

		const originalPosition = menuProto.showAtPosition;
		menuProto.showAtPosition = function (
			this: Menu,
			position: unknown,
			doc?: Document
		): unknown {
			onShow(this);
			return originalPosition.call(this, position, doc);
		};

		this.plugin.register(() => {
			itemProto.setTitle = originalSetTitle;
			menuProto.showAtMouseEvent = originalMouse;
			menuProto.showAtPosition = originalPosition;
		});
	}
}
