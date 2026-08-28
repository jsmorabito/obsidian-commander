import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

	const plugin = {
		settings: { leftRibbon },
		app: {
			isMobile: false,
			appId: "test-app",
			commands: {
				commands: {},
				executeCommandById: (id: string) => executed.push(id),
			},
			workspace: {
				leftRibbon: { items, ribbonItemsEl },
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

	return { plugin, items, ribbonItemsEl, unloaders, events, executed };
}

function fireLayoutChange(events: Record<string, Array<(...a: unknown[]) => void>>): void {
	(events["layout-change"] ?? []).forEach((cb) => cb());
}

describe("LeftRibbonManager", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});
	afterEach(() => {
		document.body.innerHTML = "";
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

		mgr.reorder();

		expect(
			Array.from(h.ribbonItemsEl.children).map((c) => c.getAttribute("aria-label"))
		).toEqual(["Star", "Home", "Close"]);
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
