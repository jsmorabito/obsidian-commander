import { describe, it, expect, beforeEach, vi } from "vitest";
import RightRibbonManager from "../manager/commands/rightRibbonManager";
import type CommanderPlugin from "../main";
import type { CommandIconPair } from "../types";

vi.mock("obsidian", async (orig) => ({
	...(await orig<typeof import("obsidian")>()),
	setTooltip: (): void => undefined,
}));

interface Item {
	id: string;
	icon: string;
	title: string;
	buttonEl?: HTMLElement;
}

/** Just enough of core's WorkspaceRibbon: `items` plus `onChange`. */
class FakeRibbon {
	public items: Item[] = [];
	public containerEl = Object.assign(document.createElement("div"), {
		createDiv(this: HTMLElement, cls: string): HTMLElement {
			const el = document.createElement("div");
			el.className = cls;
			this.appendChild(el);
			return el;
		},
		toggleClass(this: HTMLElement, cls: string, on: boolean): void {
			this.classList.toggle(cls, on);
		},
		removeClass(this: HTMLElement, cls: string): void {
			this.classList.remove(cls);
		},
	});
	public ribbonItemsEl: HTMLElement | null = null;
	public persisted = 0;

	public addRibbonItemButton(id: string, icon: string, title: string): HTMLElement {
		const buttonEl = document.createElement("div");
		this.items.push({ id, icon, title, buttonEl });
		this.onChange(false);
		return buttonEl;
	}

	public onChange(persist: boolean): void {
		if (persist) this.persisted++;
	}

	/** What core's drag does on drop: move the item, then onChange(true). */
	public drag(from: number, to: number): void {
		const [moved] = this.items.splice(from, 1);
		this.items.splice(to, 0, moved);
		this.onChange(true);
	}
}

function pair(name: string, mode = "any"): CommandIconPair {
	return { id: "cmd:" + name, icon: "star", name, mode };
}

function setup(rightRibbon: CommandIconPair[]): {
	plugin: CommanderPlugin;
	ribbon: FakeRibbon;
	unloaders: Array<() => void>;
	saves: { count: number };
} {
	const ribbon = new FakeRibbon();
	const unloaders: Array<() => void> = [];
	const saves = { count: 0 };
	const plugin = {
		settings: { rightRibbon },
		manifest: { id: "cmdr" },
		app: {
			isMobile: false,
			appId: "test-app",
			commands: { executeCommandById: (): void => undefined },
			workspace: { rightRibbon: ribbon },
		},
		register: (fn: () => void) => unloaders.push(fn),
		saveSettings: async (): Promise<void> => {
			saves.count++;
		},
	} as unknown as CommanderPlugin;
	new RightRibbonManager(plugin);
	return { plugin, ribbon, unloaders, saves };
}

const flush = (): Promise<void> => new Promise((r) => window.setTimeout(r, 0));

describe("RightRibbonManager drag reorder", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("saves the order after a native drag and still runs core's onChange", async () => {
		const pairs = [pair("A"), pair("B"), pair("C")];
		const { plugin, ribbon, saves } = setup(pairs);

		ribbon.drag(2, 0);
		await flush();

		expect(plugin.settings.rightRibbon.map((p) => p.name)).toEqual(["C", "A", "B"]);
		// Reordered in place, so the settings UI and manager share the array.
		expect(plugin.settings.rightRibbon).toBe(pairs);
		expect(ribbon.persisted).toBe(1);
		expect(saves.count).toBe(1);
	});

	it("keeps entries for another device's mode in their slots", async () => {
		const pairs = [pair("A"), pair("Phone", "mobile"), pair("B"), pair("C")];
		const { plugin, ribbon } = setup(pairs);

		ribbon.drag(2, 0); // C to the front; ribbon shows A, B, C
		await flush();

		expect(plugin.settings.rightRibbon.map((p) => p.name)).toEqual([
			"C",
			"Phone",
			"A",
			"B",
		]);
	});

	it("does not save when the order is unchanged", async () => {
		const { ribbon, saves } = setup([pair("A"), pair("B")]);

		ribbon.onChange(true); // e.g. core's context-menu hide toggle
		await flush();

		expect(saves.count).toBe(0);
	});

	it("restores core's onChange on unload", async () => {
		const { ribbon, unloaders, saves } = setup([pair("A"), pair("B")]);
		expect(Object.prototype.hasOwnProperty.call(ribbon, "onChange")).toBe(true);

		unloaders.forEach((fn) => fn());
		expect(Object.prototype.hasOwnProperty.call(ribbon, "onChange")).toBe(false);

		// Core's own method still runs; ours no longer does.
		ribbon.items.push(
			{ id: "x", icon: "star", title: "X" },
			{ id: "y", icon: "star", title: "Y" }
		);
		ribbon.drag(1, 0);
		await flush();
		expect(ribbon.persisted).toBe(1);
		expect(saves.count).toBe(0);
	});
});
