import { setIcon } from "obsidian";
import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import CommandManagerBase from "./commandManager";
import { isModeActive } from "src/util";

type RibbonItem = { icon: string; title: string; buttonEl: HTMLElement };

/** What we know about the ribbon button we built for a pair. */
interface Tracked {
	/** The icon/name we last applied to the button. */
	icon: string;
	title: string;
	el: HTMLElement;
	item: RibbonItem;
	/** What the ribbon item itself reports (its fields may be read-only). */
	seen: { icon: string; title: string };
}

export default class LeftRibbonManager extends CommandManagerBase {
	public plugin: CommanderPlugin;

	private tracked = new Map<CommandIconPair, Tracked>();
	/** Settings order the last time we synced, to tell a list reorder from an edit. */
	private lastOrder: CommandIconPair[] = [];
	/** Commander's buttons in ribbon (DOM) order the last time we looked. */
	private lastRibbonSeq: CommandIconPair[] = [];
	/** False until startup has settled; ribbon changes before then are Obsidian's. */
	private ready = false;
	/** When Obsidian last rebuilt layout; ribbon changes right after are not the user's. */
	private lastLayoutChange = 0;
	/** True while we ask Obsidian to save the ribbon order, so we don't re-read it. */
	private persisting = false;
	private followTimer: number | undefined;
	private settleTimer: number | undefined;
	private orderListeners = new Set<() => void>();
	/** Pairs hidden by their mode that should return to their old slot, not the end. */
	private returning = new Set<CommandIconPair>();

	public constructor(plugin: CommanderPlugin) {
		super(plugin, plugin.settings.leftRibbon);
		this.plugin = plugin;
		this.lastOrder = [...this.plugin.settings.leftRibbon];

		// Turned on while Obsidian is already running (not at app startup)?
		// Obsidian only applies its saved ribbon order at startup, so new buttons
		// would land at the end; remember where ours were instead.
		const snapshot = this.plugin.settings.leftRibbonOnUnload;
		const midSession =
			(this.plugin.app.workspace as { layoutReady?: boolean }).layoutReady === true;
		if (snapshot) {
			delete this.plugin.settings.leftRibbonOnUnload;
			void this.plugin.saveSettings();
		}

		this.plugin.settings.leftRibbon.forEach((pair) => {
			void this.addCommand(pair, false);
		});
		// Only when it is the same workspace: another workspace has its own order.
		if (snapshot && midSession && snapshot.workspace === this.activeWorkspaceName()) {
			this.placeFromSnapshot(snapshot.keys);
		}

		// Remove every icon we added when the plugin unloads. One bulk cleanup,
		// matching statusBarManager / explorerManager, rather than tracking each
		// pair's registration separately. First note where everything sits.
		this.plugin.register(() => {
			this.plugin.settings.leftRibbonOnUnload = {
				workspace: this.activeWorkspaceName(),
				keys: this.captureRibbonKeys(),
			};
			void this.plugin.saveSettings();
			this.plugin.settings.leftRibbon.forEach((pair) => {
				void this.removeCommand(pair, false);
			});
		});

		this.patchRibbonChange();

		// Obsidian saves and restores the ribbon order itself (per workspace), so
		// we never rearrange anything at startup: once the ribbon has settled we
		// just let Commander's settings list follow what is on screen.
		const { workspace } = this.plugin.app;
		const settle = (): void => {
			this.syncItemsToScreen();
			this.followRibbon();
			this.ready = true;
		};
		if (typeof workspace.onLayoutReady === "function") {
			workspace.onLayoutReady(() => {
				// Its own timer: a layout-change right after startup must not cancel it.
				window.clearTimeout(this.settleTimer);
				this.settleTimer = window.setTimeout(settle, 500);
			});
		} else {
			this.ready = true;
		}
		this.plugin.register(() => {
			window.clearTimeout(this.settleTimer);
			window.clearTimeout(this.followTimer);
		});

		// Obsidian rebuilds the ribbon on every workspace/layout switch (the core
		// Workspaces plugin and Workspaces Plus both call `changeLayout`), which
		// drops our imperatively-added icons. Re-add any that went missing instead
		// of leaving the ribbon broken until the plugin reloads.
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("layout-change", () => {
				this.lastLayoutChange = Date.now();
				this.reinject();
				// After a workspace switch Obsidian restores that workspace's own
				// ribbon order; the settings list follows it.
				this.schedule(() => {
					if (!this.ready) return;
					this.syncItemsToScreen();
					this.followRibbon();
				}, 150);
			})
		);
	}

	/** Name of the active core Workspaces layout ("" when there is none). */
	private activeWorkspaceName(): string {
		const app = this.plugin.app as unknown as {
			internalPlugins?: {
				getPluginById?: (id: string) =>
					| { instance?: { activeWorkspace?: string } }
					| undefined;
			};
		};
		return (
			app.internalPlugins?.getPluginById?.("workspaces")?.instance
				?.activeWorkspace ?? ""
		);
	}

	/** Key for a ribbon button: Obsidian's id when it has one, else its title. */
	private itemKey(item: { id?: string; title: string }): string {
		return item.id ?? item.title;
	}

	/** Keys of the ribbon's buttons in the order they appear on screen. */
	private captureRibbonKeys(): string[] {
		const ribbon = this.plugin.app.workspace.leftRibbon;
		const container = ribbon.ribbonItemsEl;
		if (!container) return [];
		const keys: string[] = [];
		for (const child of Array.from(container.children)) {
			const item = ribbon.items.find((i) => i.buttonEl === child);
			if (item) keys.push(this.itemKey(item));
		}
		return keys;
	}

	/**
	 * Put our buttons back where the snapshot had them, each right after the
	 * nearest preceding button that is on screen now (or before the nearest
	 * following one of someone else's). Only our buttons move.
	 */
	private placeFromSnapshot(keys: string[]): void {
		const ribbon = this.plugin.app.workspace.leftRibbon;
		const container = ribbon.ribbonItemsEl;
		if (!container) return;
		const byKey = new Map<string, HTMLElement>();
		ribbon.items.forEach((i) => byKey.set(this.itemKey(i), i.buttonEl));
		const ours = new Set<HTMLElement | undefined>(
			this.plugin.settings.leftRibbon.map((p) => this.findItem(p)?.buttonEl)
		);
		const here = (el: HTMLElement | undefined): el is HTMLElement =>
			!!el && el.parentElement === container;

		const before = Array.from(container.children);
		keys.forEach((key, at) => {
			const el = byKey.get(key);
			if (!here(el) || !ours.has(el)) return;
			for (let j = at - 1; j >= 0; j--) {
				const prev = byKey.get(keys[j]);
				if (here(prev) && prev !== el) return void prev.after(el);
			}
			for (let j = at + 1; j < keys.length; j++) {
				const next = byKey.get(keys[j]);
				if (here(next) && !ours.has(next)) return void next.before(el);
			}
		});
		// Nothing moved (already in place)? Then there is nothing to save.
		const after = Array.from(container.children);
		if (before.every((c, i) => c === after[i])) return;
		this.syncItemsToScreen();
		this.followRibbon();
		this.persistOrder();
	}

	/** One pending timer: later calls replace earlier ones. */
	private schedule(fn: () => void, ms: number): void {
		window.clearTimeout(this.followTimer);
		this.followTimer = window.setTimeout(fn, ms);
	}

	/** Make the settings list follow the ribbon and tell any open settings page. */
	private followRibbon(): void {
		if (!this.adoptRibbonOrder()) return;
		void this.plugin.saveSettings();
		this.orderListeners.forEach((cb) => cb());
	}

	/**
	 * Obsidian redraws and drags the ribbon from its own list of items, so that
	 * list must match the buttons on screen. Any time we (or Obsidian's restore)
	 * move buttons around without touching the list, a later drag lands several
	 * slots away from where the user dropped it.
	 */
	private syncItemsToScreen(): void {
		const ribbon = this.plugin.app.workspace.leftRibbon;
		const container = ribbon.ribbonItemsEl;
		if (!container) return;
		const children = Array.from(container.children);
		const onScreen = ribbon.items
			.filter((i) => children.includes(i.buttonEl))
			.sort((a, b) => children.indexOf(a.buttonEl) - children.indexOf(b.buttonEl));
		// Refill only the slots of items that are on screen.
		const slots = ribbon.items.flatMap((i, n) => (onScreen.includes(i) ? [n] : []));
		slots.forEach((n, k) => (ribbon.items[n] = onScreen[k]));
	}

	/**
	 * Ask Obsidian to save the ribbon order (it keeps one per workspace). Its own
	 * list of items must match what is on screen first, otherwise a button we
	 * moved, renamed or added would be saved in the wrong place or not at all.
	 */
	private persistOrder(): void {
		this.syncItemsToScreen();
		const ribbon = this.plugin.app.workspace.leftRibbon;
		if (typeof ribbon.onChange !== "function") return;
		this.persisting = true;
		try {
			ribbon.onChange(true);
		} finally {
			this.persisting = false;
		}
	}

	/** Called after the ribbon was reordered by dragging in Obsidian itself. */
	public onOrderChange(listener: () => void): void {
		this.orderListeners.add(listener);
	}

	/**
	 * Obsidian's own drag-to-reorder calls `ribbon.onChange(true)`. Wrap it so the
	 * order the user dragged Commander's buttons into is written back to settings
	 * (and the open settings list), instead of being overwritten by the old order.
	 */
	private patchRibbonChange(): void {
		const ribbon = this.plugin.app.workspace.leftRibbon;
		if (typeof ribbon.onChange !== "function") return;
		const original = ribbon.onChange;
		let active = true;
		const patched = (persist: boolean): void => {
			// A drop leaves Obsidian's item list one slot off from where the button
			// was dropped on screen, and it redraws from that list. Trust the
			// screen: the button lands exactly where the user let go of it.
			if (active && persist && !this.persisting) this.syncItemsToScreen();
			original.call(ribbon, persist);
			if (active && persist && !this.persisting) void this.syncOrderFromRibbon();
		};
		ribbon.onChange = patched;
		this.plugin.register(() => {
			active = false;
			if (ribbon.onChange === patched) ribbon.onChange = original;
		});
	}

	/** Our pairs that have a live button, in the order they appear in the ribbon. */
	private ribbonSeq(): CommandIconPair[] {
		const container = this.plugin.app.workspace.leftRibbon.ribbonItemsEl;
		if (!container) return [];
		const children = Array.from(container.children);
		const present: { pair: CommandIconPair; index: number }[] = [];
		for (const pair of this.plugin.settings.leftRibbon) {
			const el = this.findItem(pair)?.buttonEl;
			const index = el ? children.indexOf(el) : -1;
			if (index !== -1) present.push({ pair, index });
		}
		return present.sort((a, b) => a.index - b.index).map((e) => e.pair);
	}

	/**
	 * Reorder settings.leftRibbon to match the ribbon, but only when the user
	 * actually moved our buttons: `onChange(true)` also fires for hide/unhide and
	 * Obsidian's own restore, where the ribbon order is not a user decision.
	 */
	private async syncOrderFromRibbon(): Promise<void> {
		if (!this.ready) return;
		// A workspace switch rebuilds the ribbon and fires onChange(true) itself;
		// that is Obsidian re-rendering, not the user rearranging.
		if (Date.now() - this.lastLayoutChange < 600) return;
		if (this.adoptRibbonOrder()) {
			await this.plugin.saveSettings();
			this.orderListeners.forEach((cb) => cb());
		}
	}

	/**
	 * Make settings.leftRibbon follow the order of our buttons on screen. Pairs
	 * without a button (hidden on this device) keep their place. True if the
	 * settings order changed.
	 */
	private adoptRibbonOrder(): boolean {
		const seq = this.ribbonSeq();
		this.lastRibbonSeq = seq;
		const pairs = this.plugin.settings.leftRibbon;
		const slots = pairs.flatMap((p, i) => (seq.includes(p) ? [i] : []));
		if (seq.every((p, n) => p === pairs[slots[n]])) return false;
		seq.forEach((p, n) => (pairs[slots[n]] = p));
		this.lastOrder = [...pairs];
		return true;
	}

	private record(pair: CommandIconPair, item: RibbonItem): void {
		this.tracked.set(pair, {
			icon: pair.icon,
			title: pair.name,
			el: item.buttonEl,
			item,
			seen: { icon: item.icon, title: item.title },
		});
	}

	private findItem(pair: CommandIconPair): RibbonItem | undefined {
		const known = this.tracked.get(pair);
		const items = this.plugin.app.workspace.leftRibbon.items;
		if (known) {
			// Obsidian may rebuild a button's element, so match the item, its
			// element, or the fields it last reported, not the (newer) settings.
			return items.find(
				(i) =>
					i === known.item ||
					i.buttonEl === known.el ||
					(i.icon === known.seen.icon && i.title === known.seen.title)
			);
		}
		// Untracked: match by icon/name, but never grab a button another of our
		// pairs already owns.
		const owned = new Set<unknown>();
		this.tracked.forEach((t) => owned.add(t.item));
		return items.find(
			(i) => !owned.has(i) && i.icon === pair.icon && i.title === pair.name
		);
	}

	/**
	 * Re-add any configured ribbon icons whose button is no longer in the DOM,
	 * e.g. after a workspace switch tore the ribbon down and rebuilt it. No-ops
	 * (and touches no DOM) when every icon is already present, which is the
	 * common case for the frequently-fired `layout-change` event.
	 */
	private reinject(): void {
		let injected = false;
		for (const pair of this.plugin.settings.leftRibbon) {
			if (!isModeActive(pair.mode, this.plugin)) continue;

			const item = this.findItem(pair);
			if (item?.buttonEl?.isConnected) continue;
			if (item) {
				// Stale entry left behind by a torn-down ribbon: drop it so
				// addCommand() rebuilds the button instead of matching it.
				this.plugin.app.workspace.leftRibbon.items.remove(item);
			}
			void this.addCommand(pair, false);
			injected = true;
		}
		if (injected) this.applyOrder();
	}

	/**
	 * Put our ribbon buttons back into the order the user configured them in, but
	 * only when they are actually out of order. Buttons swap places only among
	 * the slots they already occupy, so other plugins' icons sitting between ours
	 * stay where Obsidian's own saved ribbon order put them.
	 */
	private applyOrder(): void {
		const container = this.plugin.app.workspace.leftRibbon.ribbonItemsEl;
		if (!container) return;

		const desired: HTMLElement[] = [];
		for (const pair of this.plugin.settings.leftRibbon) {
			const el = this.findItem(pair)?.buttonEl;
			if (el?.isConnected) desired.push(el);
		}
		if (desired.length < 2) return;

		const children = Array.from(container.children);
		const slots = desired
			.map((el) => children.indexOf(el))
			.filter((i) => i !== -1)
			.sort((a, b) => a - b);
		if (slots.length === desired.length && slots.every((s, n) => children[s] === desired[n])) {
			this.lastRibbonSeq = this.ribbonSeq();
			return;
		}

		const next = [...children];
		slots.forEach((s, n) => (next[s] = desired[n]));
		container.append(...next);
		this.syncItemsToScreen();
		this.lastRibbonSeq = this.ribbonSeq();
	}

	/**
	 * Put a button that comes back (its mode became active again) next to its
	 * neighbours in settings order, rather than past every other plugin's icon.
	 * Brand-new commands are still appended to the end of the ribbon.
	 */
	private placeButton(pair: CommandIconPair, el: HTMLElement): void {
		const container = this.plugin.app.workspace.leftRibbon.ribbonItemsEl;
		if (!container) return;
		const pairs = this.plugin.settings.leftRibbon;
		const at = pairs.indexOf(pair);
		if (at === -1) return;
		const live = (p: CommandIconPair): HTMLElement | undefined => {
			const e = this.findItem(p)?.buttonEl;
			return e && e !== el && e.parentElement === container ? e : undefined;
		};
		for (let i = at - 1; i >= 0; i--) {
			const prev = live(pairs[i]);
			if (prev) return void prev.after(el);
		}
		for (let i = at + 1; i < pairs.length; i++) {
			const next = live(pairs[i]);
			if (next) return void next.before(el);
		}
	}

	private createButton(pair: CommandIconPair): void {
		this.plugin.addRibbonIcon(pair.icon, pair.name, () =>
			this.plugin.app.commands.executeCommandById(pair.id)
		);
		const el = this.findItem(pair)?.buttonEl;
		if (el && this.returning.delete(pair)) this.placeButton(pair, el);
		this.syncItemsToScreen();
	}

	public async addCommand(
		pair: CommandIconPair,
		newlyAdded = true
	): Promise<void> {
		if (newlyAdded) {
			this.plugin.settings.leftRibbon.push(pair);
			await this.plugin.saveSettings();
		}
		if (!isModeActive(pair.mode, this.plugin)) return;

		// Our tracked button is gone (ribbon rebuilt): forget it so we rebuild.
		if (this.tracked.has(pair) && !this.findItem(pair)) {
			this.tracked.delete(pair);
		}

		// Don't stack a second button if one is already live (e.g. Obsidian
		// re-created it on rebuild before our layout-change handler ran).
		if (!this.findItem(pair)?.buttonEl?.isConnected) {
			this.createButton(pair);
		}

		const nativeAction = this.findItem(pair);
		if (nativeAction) {
			this.record(pair, nativeAction);
			nativeAction.buttonEl.style.color =
				pair.color === "#000000" || pair.color === undefined
					? "inherit"
					: pair.color;
		}
		this.lastRibbonSeq = this.ribbonSeq();
		if (newlyAdded) this.persistOrder();
	}

	public async removeCommand(
		pair: CommandIconPair,
		remove = true
	): Promise<void> {
		if (remove) {
			this.plugin.settings.leftRibbon.remove(pair);
			await this.plugin.saveSettings();
		}
		const nativeAction = this.findItem(pair);
		if (nativeAction) {
			nativeAction.buttonEl.remove();
			this.plugin.app.workspace.leftRibbon.items.remove(nativeAction);
		}
		this.tracked.delete(pair);
		this.lastRibbonSeq = this.ribbonSeq();
		if (remove) this.persistOrder();
	}

	/**
	 * Apply a changed icon/name to the pair's button. An icon change is made in
	 * place. A rename gets a fresh button at the same position, because Obsidian
	 * derives a button's id from its title and saves the ribbon order by id: a
	 * button still carrying the old id would lose its place on the next reload.
	 * Returns true when a button was rebuilt, i.e. the saved order needs updating.
	 */
	private refreshButton(pair: CommandIconPair, item: RibbonItem): boolean {
		if (item.title === pair.name) {
			try {
				item.icon = pair.icon;
			} catch {
				// handled below by checking whether the write stuck
			}
			if (item.icon === pair.icon) {
				setIcon(item.buttonEl, pair.icon);
				this.record(pair, item);
				return false;
			}
		}

		const container = this.plugin.app.workspace.leftRibbon.ribbonItemsEl;
		const old = item.buttonEl;
		const sibling = old.nextElementSibling;
		old.remove();
		this.plugin.app.workspace.leftRibbon.items.remove(item);
		this.tracked.delete(pair);
		this.createButton(pair);
		const created = this.findItem(pair)?.buttonEl;
		if (created && container) {
			// Restore the exact old slot.
			if (sibling && sibling.parentElement === container) sibling.before(created);
			else if (!sibling) container.append(created);
		}
		this.syncItemsToScreen();
		return true;
	}

	/**
	 * Bring the ribbon in line with settings WITHOUT tearing buttons down, so a
	 * button the user has positioned stays where it is when a command is added
	 * or its icon, name, color or mode changes. Changed buttons are updated in
	 * place; only new or newly active ones are created, next to their
	 * neighbours in settings order.
	 */
	public reorder(): void {
		let persist = false;
		for (const pair of this.plugin.settings.leftRibbon) {
			const item = this.findItem(pair);
			if (!isModeActive(pair.mode, this.plugin)) {
				if (item) {
					this.returning.add(pair);
					void this.removeCommand(pair, false);
				}
				continue;
			}
			const known = this.tracked.get(pair);
			if (
				item &&
				known &&
				(known.icon !== pair.icon || known.title !== pair.name)
			) {
				persist = this.refreshButton(pair, item) || persist;
			}
			const hadButton = !!this.findItem(pair)?.buttonEl?.isConnected;
			void this.addCommand(pair, false);
			if (!hadButton) persist = true; // a button came back (mode re-activated)
		}
		// Only force Commander's order when the settings list order itself changed
		// (drag in settings). Plain edits/adds must leave wherever the user put
		// the buttons in the ribbon alone.
		const pairs = this.plugin.settings.leftRibbon;
		const prev = this.lastOrder.filter((p) => pairs.includes(p));
		const cur = pairs.filter((p) => this.lastOrder.includes(p));
		if (prev.some((p, i) => p !== cur[i])) {
			this.applyOrder();
			persist = true;
		}
		this.lastOrder = [...pairs];
		this.lastRibbonSeq = this.ribbonSeq();
		if (persist) this.persistOrder();
	}
}
