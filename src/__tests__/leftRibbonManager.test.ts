import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import LeftRibbonManager from "../manager/commands/leftRibbonManager";
import type CommanderPlugin from "../main";
import type { CommandIconPair } from "../types";

interface RibbonItem {
	icon: string;
	title: string;
	buttonEl: HTMLElement;
	onClick: () => void;
}

interface Harness {
	plugin: CommanderPlugin;
	items: RibbonItem[];
	ribbonItemsEl: HTMLElement;
	unloaders: Array<() => void>;
	events: Record<string, Array<(...a: unknown[]) => void>>;
	executed: string[];
	layoutReady: Array<() => void>;
	changes: boolean[];
	changeItems: string[][];
	workspaces: { activeWorkspace: string };
}

function pair(over: Partial<CommandIconPair> = {}): CommandIconPair {
	return {
		id: over.id ?? "cmd:" + (over.icon ?? "star"),
		icon: over.icon ?? "star",
		name: over.name ?? "Star",
		mode: over.mode ?? "any",
		color: over.color,
	};
}

function makeHarness(leftRibbon: CommandIconPair[]): Harness {
	const ribbonItemsEl = document.createElement("div");
	document.body.appendChild(ribbonItemsEl); // so buttonEl.isConnected is true
	const items: RibbonItem[] = [];
	const unloaders: Array<() => void> = [];
	const events: Record<string, Array<(...a: unknown[]) => void>> = {};
	const executed: string[] = [];
	const layoutReady: Array<() => void> = [];
	const changes: boolean[] = [];
	const changeItems: string[][] = [];
	const workspaces = { activeWorkspace: "" };

	const plugin = {
		settings: { leftRibbon },
		app: {
			isMobile: false,
			internalPlugins: { getPluginById: () => ({ instance: workspaces }) },
			appId: "test-app",
			commands: {
				commands: {},
				executeCommandById: (id: string) => executed.push(id),
			},
			workspace: {
				leftRibbon: { items, ribbonItemsEl, onChange: (p: boolean) => {
					changes.push(p);
					changeItems.push(items.map((i) => i.title));
				} },
				onLayoutReady: (cb: () => void) => layoutReady.push(cb),
				on: (name: string, cb: (...a: unknown[]) => void) => {
					(events[name] ??= []).push(cb);
					return { name, cb };
				},
			},
		},
		addRibbonIcon: (icon: string, title: string, onClick: () => void) => {
			const buttonEl = document.createElement("div");
			buttonEl.setAttribute("aria-label", title);
			ribbonItemsEl.appendChild(buttonEl);
			items.push({ icon, title, buttonEl, onClick });
			return buttonEl;
		},
		register: (fn: () => void) => unloaders.push(fn),
		registerEvent: () => undefined,
		saveSettings: async () => undefined,
	} as unknown as CommanderPlugin;

	return { plugin, items, ribbonItemsEl, unloaders, events, executed, layoutReady, changes, changeItems, workspaces };
}

function fireLayoutChange(events: Record<string, Array<(...a: unknown[]) => void>>): void {
	(events["layout-change"] ?? []).forEach((cb) => cb());
}

/** Run the startup hooks and let the settle timer fire, as after a real launch. */
function settle(h: Harness): void {
	h.layoutReady.forEach((cb) => cb());
	vi.advanceTimersByTime(600);
}

const labels = (h: Harness): Array<string | null> =>
	Array.from(h.ribbonItemsEl.children).map((c) => c.getAttribute("aria-label"));

describe("LeftRibbonManager", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		vi.useFakeTimers();
	});
	afterEach(() => {
		document.body.innerHTML = "";
		vi.useRealTimers();
	});

	it("adds every configured icon on construction", () => {
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);

		expect(h.items.map((i) => i.title)).toEqual(["Star", "Home"]);
		expect(h.ribbonItemsEl.children).toHaveLength(2);
	});

	it("re-injects an icon that a layout rebuild removed", () => {
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);

		// Simulate Obsidian tearing the ribbon down: drop the Home button + entry.
		const home = h.items.find((i) => i.title === "Home")!;
		home.buttonEl.remove();
		h.items.splice(h.items.indexOf(home), 1);
		expect(h.items).toHaveLength(1);

		fireLayoutChange(h.events);

		expect(h.items.map((i) => i.title).sort()).toEqual(["Home", "Star"]);
		expect(h.ribbonItemsEl.children).toHaveLength(2);
	});

	it("leaves a user-arranged ribbon order alone on layout-change when nothing is missing", () => {
		// Regression guard: applyOrder() used to run on every layout-change and
		// snap our icons back to settings order, overriding the user's native
		// ribbon arrangement.
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);

		// User drags Home above Star in Obsidian's own ribbon reorder UI.
		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;
		h.ribbonItemsEl.append(byTitle("Home"), byTitle("Star"));

		fireLayoutChange(h.events);
		fireLayoutChange(h.events);

		expect(
			Array.from(h.ribbonItemsEl.children).map((c) => c.getAttribute("aria-label"))
		).toEqual(["Home", "Star"]);
		expect(h.items).toHaveLength(2);
	});

	it("re-injects a missing icon and repairs scrambled order in one pass", () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
			pair({ icon: "x", name: "Close" }),
		];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);

		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;
		h.ribbonItemsEl.append(byTitle("Close"), byTitle("Star")); // scramble
		const home = h.items.find((i) => i.title === "Home")!; // drop entirely
		home.buttonEl.remove();
		h.items.splice(h.items.indexOf(home), 1);

		fireLayoutChange(h.events);

		expect(
			Array.from(h.ribbonItemsEl.children).map((c) => c.getAttribute("aria-label"))
		).toEqual(["Star", "Home", "Close"]);
		expect(h.items).toHaveLength(3);
	});

	it("does not create a duplicate when the button already exists", () => {
		const pairs = [pair({ icon: "star", name: "Star" })];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);

		fireLayoutChange(h.events);

		expect(h.items).toHaveLength(1);
		expect(h.ribbonItemsEl.querySelectorAll('[aria-label="Star"]')).toHaveLength(1);
	});

	it("restores configured order after a rebuild leaves icons scrambled", () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
			pair({ icon: "x", name: "Close" }),
		];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);

		// Scramble the DOM order (Close, Star, Home) without changing settings.
		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;
		h.ribbonItemsEl.append(byTitle("Close"), byTitle("Star"), byTitle("Home"));
		expect(
			Array.from(h.ribbonItemsEl.children).map((c) => c.getAttribute("aria-label"))
		).toEqual(["Close", "Star", "Home"]);

		// Reorder in settings (move Close to the front): ribbon follows.
		pairs.unshift(pairs.pop()!);
		mgr.reorder();

		expect(
			Array.from(h.ribbonItemsEl.children).map((c) => c.getAttribute("aria-label"))
		).toEqual(["Close", "Star", "Home"]);
	});

	it("does not undo a ribbon drag order when a command is edited", () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
			pair({ icon: "x", name: "Close" }),
		];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;
		// User dragged Close between Star and Home in the ribbon itself.
		h.ribbonItemsEl.append(byTitle("Star"), byTitle("Close"), byTitle("Home"));

		pairs[2].icon = "moon";
		mgr.reorder();

		expect(
			Array.from(h.ribbonItemsEl.children).map((c) => c.getAttribute("aria-label"))
		).toEqual(["Star", "Close", "Home"]);
	});

	it("renames without adding a duplicate when item.title is read-only", () => {
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		for (const item of h.items) {
			const { title } = item;
			Object.defineProperty(item, "title", { get: () => title });
		}

		pairs[0].name = "Starry";
		mgr.reorder();
		pairs[0].name = "Starrier";
		mgr.reorder();

		expect(h.items).toHaveLength(2);
		expect(h.ribbonItemsEl.children).toHaveLength(2);
		expect(h.ribbonItemsEl.firstElementChild?.getAttribute("aria-label")).toBe("Starrier");
	});

	it("renames without a duplicate when Obsidian rebuilds the button element", () => {
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		for (const item of h.items) {
			const { title } = item;
			Object.defineProperty(item, "title", { get: () => title });
		}
		// Ribbon refresh: item objects survive but their buttons are rebuilt.
		const swap = (): void => {
			for (const item of h.items) {
				const next = document.createElement("div");
				next.setAttribute("aria-label", item.title);
				item.buttonEl.replaceWith(next);
				item.buttonEl = next;
			}
		};
		swap();
		pairs[0].name = "Starry";
		mgr.reorder();
		swap();
		pairs[0].name = "Starrier";
		mgr.reorder();

		expect(h.items).toHaveLength(2);
		expect(h.ribbonItemsEl.children).toHaveLength(2);
	});

	it("adds a new command without moving existing buttons", () => {
		const pairs = [pair({ icon: "star", name: "Star" })];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		const first = h.items[0].buttonEl;

		void mgr.addCommand(pair({ icon: "home", name: "Home" }));
		mgr.reorder();

		expect(h.items).toHaveLength(2);
		expect(h.items[0].buttonEl).toBe(first);
		expect(h.ribbonItemsEl.firstElementChild).toBe(first);
	});

	it("writes a ribbon drag order back into settings", async () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
			pair({ icon: "x", name: "Close" }),
		];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);
		settle(h);
		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;
		h.ribbonItemsEl.append(byTitle("Close"), byTitle("Star"), byTitle("Home"));

		(h.plugin.app.workspace.leftRibbon as unknown as { onChange: (p: boolean) => void }).onChange(true);
		await Promise.resolve();

		expect(pairs.map((p) => p.name)).toEqual(["Close", "Star", "Home"]);
	});

	it("reorders our buttons without moving other plugins' icons", () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
		];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		const foreign = document.createElement("div");
		foreign.setAttribute("aria-label", "Foreign");
		h.ribbonItemsEl.insertBefore(foreign, h.items[1].buttonEl);
		expect(labels(h)).toEqual(["Star", "Foreign", "Home"]);

		pairs.reverse();
		mgr.reorder();

		expect(labels(h)).toEqual(["Home", "Foreign", "Star"]);
	});

	it("puts a re-activated command back next to its neighbours", () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
			pair({ icon: "x", name: "Close" }),
		];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);

		pairs[1].mode = "mobile"; // inactive on this (desktop) harness
		mgr.reorder();
		expect(labels(h)).toEqual(["Star", "Close"]);

		pairs[1].mode = "any";
		mgr.reorder();
		expect(labels(h)).toEqual(["Star", "Home", "Close"]);
	});

	it("does not bind a new command to a renamed command's button", async () => {
		const pairs = [pair({ icon: "star", name: "Star" })];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		const itemBefore = h.items[0];
		Object.defineProperty(itemBefore, "title", { get: () => "Star" });

		pairs[0].name = "Starry";
		mgr.reorder();
		await mgr.addCommand(pair({ icon: "star", name: "Star", id: "cmd:other" }));

		expect(h.items).toHaveLength(2);
	});

	it("appends a newly added command to the end of the ribbon", async () => {
		const pairs = [pair({ icon: "star", name: "Star" })];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		const foreign = document.createElement("div");
		foreign.setAttribute("aria-label", "Foreign");
		h.ribbonItemsEl.append(foreign);

		await mgr.addCommand(pair({ icon: "home", name: "Home" }));

		expect(labels(h)).toEqual(["Star", "Foreign", "Home"]);
	});

	it("edits an icon in place and rebuilds a renamed button at the same position", () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
			pair({ icon: "x", name: "Close" }),
		];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		const foreign = document.createElement("div");
		foreign.setAttribute("aria-label", "Foreign");
		h.ribbonItemsEl.appendChild(foreign);
		const star = h.items[0].buttonEl;

		pairs[0].icon = "moon";
		pairs[2].color = "#ff0000";
		mgr.reorder();
		expect(h.items[0].buttonEl).toBe(star); // icon edit: same button
		expect(h.items[0].icon).toBe("moon");
		expect(h.changes).toEqual([]); // nothing to save

		pairs[1].name = "House";
		mgr.reorder();

		expect(labels(h)).toEqual(["Star", "House", "Close", "Foreign"]);
		expect(h.items).toHaveLength(3);
		// Obsidian's own list follows the screen, and it was asked to save once.
		expect(h.items.map((i) => i.title)).toEqual(["Star", "House", "Close"]);
		expect(h.changes).toEqual([true]);
		// A later rename still finds the rebuilt button.
		pairs[1].name = "Home again";
		mgr.reorder();
		expect(h.items).toHaveLength(3);
		expect(labels(h)).toEqual(["Star", "Home again", "Close", "Foreign"]);
	});

	it("saves Obsidian's ribbon order after a settings reorder without re-reading it", async () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
			pair({ icon: "x", name: "Close" }),
		];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		settle(h);

		pairs.unshift(pairs.pop()!);
		mgr.reorder();
		await Promise.resolve();

		expect(labels(h)).toEqual(["Close", "Star", "Home"]);
		expect(h.items.map((i) => i.title)).toEqual(["Close", "Star", "Home"]);
		expect(h.changes).toEqual([true]);
		expect(pairs.map((p) => p.name)).toEqual(["Close", "Star", "Home"]);
	});

	it("never rearranges the ribbon at startup; settings follow what Obsidian restored", () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "x", name: "Close" }),
			pair({ icon: "home", name: "Home" }),
		];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);
		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;
		// Obsidian's saved ribbon order put them differently.
		h.ribbonItemsEl.append(byTitle("Home"), byTitle("Star"), byTitle("Close"));

		settle(h);

		expect(labels(h)).toEqual(["Home", "Star", "Close"]);
		expect(pairs.map((p) => p.name)).toEqual(["Home", "Star", "Close"]);
		expect(h.changes).toEqual([]);
	});

	it("ignores ribbon changes during startup and right after a layout rebuild", async () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
		];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);
		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;
		const fire = async (): Promise<void> => {
			(h.plugin.app.workspace.leftRibbon as unknown as { onChange: (p: boolean) => void }).onChange(true);
			await Promise.resolve();
		};

		h.ribbonItemsEl.append(byTitle("Home"), byTitle("Star"));
		await fire(); // before startup settles
		expect(pairs.map((p) => p.name)).toEqual(["Star", "Home"]);

		settle(h);
		expect(pairs.map((p) => p.name)).toEqual(["Home", "Star"]);

		// A workspace switch rebuilds the ribbon and calls onChange(true) itself.
		fireLayoutChange(h.events);
		h.ribbonItemsEl.append(byTitle("Star"), byTitle("Home"));
		await fire();
		expect(pairs.map((p) => p.name)).toEqual(["Home", "Star"]);

		// After the settle delay, the settings list follows the restored order.
		vi.advanceTimersByTime(200);
		expect(pairs.map((p) => p.name)).toEqual(["Star", "Home"]);
	});

	it("rebuilds a renamed button when the ribbon item is read-only", () => {
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		for (const item of h.items) {
			const { title, icon } = item;
			Object.defineProperty(item, "title", { get: () => title });
			Object.defineProperty(item, "icon", { get: () => icon });
		}
		const foreign = document.createElement("div");
		foreign.setAttribute("aria-label", "Foreign");
		h.ribbonItemsEl.append(foreign);

		pairs[0].name = "Starry";
		mgr.reorder();

		expect(labels(h)).toEqual(["Starry", "Home", "Foreign"]);
		expect(h.items.map((i) => i.title)).toEqual(["Starry", "Home"]);
	});

	it("keeps Obsidian's item list in step with the screen so later drags land correctly", () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
			pair({ icon: "x", name: "Close" }),
		];
		const h = makeHarness(pairs);
		const mgr = new LeftRibbonManager(h.plugin);
		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;

		// Obsidian's restore moved buttons on screen but not its own list.
		h.ribbonItemsEl.append(byTitle("Close"), byTitle("Star"), byTitle("Home"));
		settle(h);
		expect(h.items.map((i) => i.title)).toEqual(labels(h));

		// A settings reorder moves buttons on screen; the list must follow.
		pairs.reverse();
		mgr.reorder();
		expect(h.items.map((i) => i.title)).toEqual(labels(h));
	});

	it("makes Obsidian's item list match the screen before it saves a drop", () => {
		const pairs = [
			pair({ icon: "star", name: "Star" }),
			pair({ icon: "home", name: "Home" }),
			pair({ icon: "x", name: "Close" }),
		];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);
		settle(h);
		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;

		// The user dropped Star at the very end on screen; Obsidian's list has it
		// one slot too high.
		h.ribbonItemsEl.append(byTitle("Star"));
		const star = h.items.shift()!;
		h.items.splice(1, 0, star); // [Home, Star, Close]
		(h.plugin.app.workspace.leftRibbon as unknown as { onChange: (p: boolean) => void }).onChange(true);

		expect(h.changeItems.at(-1)).toEqual(["Home", "Close", "Star"]);
	});

	it("remembers where its buttons were when turned off and restores them when turned on", () => {
		const settingsOf = (h: Harness): { leftRibbonOnUnload?: { workspace: string; keys: string[] } } =>
			h.plugin.settings;
		const addForeign = (h: Harness, title: string): void => {
			const buttonEl = document.createElement("div");
			buttonEl.setAttribute("aria-label", title);
			h.ribbonItemsEl.appendChild(buttonEl);
			h.items.push({ icon: "x", title, buttonEl, onClick: () => undefined });
		};

		// First run: Foreign A, Star, Foreign B, Home; then turn the plugin off.
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h1 = makeHarness(pairs);
		addForeign(h1, "Foreign a");
		new LeftRibbonManager(h1.plugin);
		addForeign(h1, "Foreign b");
		const byTitle = (h: Harness, t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;
		h1.ribbonItemsEl.append(byTitle(h1, "Foreign a"), byTitle(h1, "Star"), byTitle(h1, "Foreign b"), byTitle(h1, "Home"));
		h1.unloaders.forEach((fn) => fn());
		expect(settingsOf(h1).leftRibbonOnUnload).toEqual({
			workspace: "",
			keys: ["Foreign a", "Star", "Foreign b", "Home"],
		});

		// Turned back on mid-session: others are already there, ours would be appended.
		const h2 = makeHarness(pairs);
		(h2.plugin.app.workspace as unknown as { layoutReady: boolean }).layoutReady = true;
		h2.plugin.settings.leftRibbonOnUnload = settingsOf(h1).leftRibbonOnUnload;
		addForeign(h2, "Foreign a");
		addForeign(h2, "Foreign b");
		new LeftRibbonManager(h2.plugin);

		expect(labels(h2)).toEqual(["Foreign a", "Star", "Foreign b", "Home"]);
		expect(settingsOf(h2).leftRibbonOnUnload).toBeUndefined();
	});

	it("ignores the unload snapshot at app startup", () => {
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		h.plugin.settings.leftRibbonOnUnload = { workspace: "", keys: ["Home", "Star"] };
		new LeftRibbonManager(h.plugin);

		expect(labels(h)).toEqual(["Star", "Home"]);
		expect(h.plugin.settings.leftRibbonOnUnload).toBeUndefined();
	});

	it("still settles at startup when a layout-change arrives inside the settle window", async () => {
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);
		const byTitle = (t: string): HTMLElement => h.items.find((i) => i.title === t)!.buttonEl;
		h.layoutReady.forEach((cb) => cb());

		vi.advanceTimersByTime(200);
		fireLayoutChange(h.events); // Obsidian restoring tabs, mid-window
		vi.advanceTimersByTime(700); // past the settle delay and the follow delay

		// Ready now: a drag in the ribbon reaches Commander's settings.
		vi.advanceTimersByTime(1000);
		h.ribbonItemsEl.append(byTitle("Home"), byTitle("Star"));
		(h.plugin.app.workspace.leftRibbon as unknown as { onChange: (p: boolean) => void }).onChange(true);
		await Promise.resolve();
		expect(pairs.map((p) => p.name)).toEqual(["Home", "Star"]);
	});

	it("does not apply the unload snapshot in a different workspace", () => {
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		(h.plugin.app.workspace as unknown as { layoutReady: boolean }).layoutReady = true;
		h.workspaces.activeWorkspace = "Writing";
		h.plugin.settings.leftRibbonOnUnload = {
			workspace: "Music",
			keys: ["Foreign a", "Home", "Star"],
		};
		const buttonEl = document.createElement("div");
		buttonEl.setAttribute("aria-label", "Foreign a");
		h.ribbonItemsEl.appendChild(buttonEl);
		h.items.push({ icon: "x", title: "Foreign a", buttonEl, onClick: () => undefined });
		new LeftRibbonManager(h.plugin);

		// Created in settings order at the end; the Music snapshot was not used.
		expect(labels(h)).toEqual(["Foreign a", "Star", "Home"]);
		expect(h.changes).toEqual([]);
	});

	it("does not ask Obsidian to save when restoring changes nothing", () => {
		const pairs = [pair({ icon: "star", name: "Star" })];
		const h = makeHarness(pairs);
		(h.plugin.app.workspace as unknown as { layoutReady: boolean }).layoutReady = true;
		h.plugin.settings.leftRibbonOnUnload = { workspace: "", keys: ["Foreign a", "Star"] };
		const buttonEl = document.createElement("div");
		buttonEl.setAttribute("aria-label", "Foreign a");
		h.ribbonItemsEl.appendChild(buttonEl);
		h.items.push({ icon: "x", title: "Foreign a", buttonEl, onClick: () => undefined });
		new LeftRibbonManager(h.plugin);

		expect(labels(h)).toEqual(["Foreign a", "Star"]);
		expect(h.changes).toEqual([]);
	});

	it("removes all icons via the single unload cleanup", () => {
		const pairs = [pair({ icon: "star", name: "Star" }), pair({ icon: "home", name: "Home" })];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);
		expect(h.items).toHaveLength(2);

		h.unloaders.forEach((fn) => fn());

		expect(h.items).toHaveLength(0);
		expect(h.ribbonItemsEl.children).toHaveLength(0);
	});

	it("wires each icon to execute its command id", () => {
		const pairs = [pair({ id: "app:go", icon: "star", name: "Star" })];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);

		h.items[0].onClick();

		expect(h.executed).toEqual(["app:go"]);
	});

	it("skips icons whose mode does not match the platform", () => {
		const pairs = [
			pair({ icon: "star", name: "Star", mode: "any" }),
			pair({ icon: "phone", name: "Phone", mode: "mobile" }),
		];
		const h = makeHarness(pairs);
		new LeftRibbonManager(h.plugin);

		expect(h.items.map((i) => i.title)).toEqual(["Star"]);
	});
});
