import { describe, it, expect } from "vitest";
import { injectIcons } from "../util";
import type CommanderPlugin from "../main";
import type { AdvancedToolbarSettings } from "../types";

function makePlugin(commands: Record<string, { icon?: string }>): CommanderPlugin {
	return {
		app: { commands: { commands } },
	} as unknown as CommanderPlugin;
}

function makeSettings(
	mappedIcons: AdvancedToolbarSettings["mappedIcons"]
): AdvancedToolbarSettings {
	return {
		rowHeight: 48,
		rowCount: 1,
		spacing: 0,
		buttonWidth: 48,
		columnLayout: false,
		mappedIcons,
		tooltips: false,
		heightOffset: 0,
	};
}

describe("injectIcons", () => {
	it("sets the icon on a matching command", () => {
		const commands = { "my:command": { icon: "old-icon" } };
		const settings = makeSettings([{ iconID: "star", commandID: "my:command" }]);
		injectIcons(settings, makePlugin(commands));
		expect(commands["my:command"].icon).toBe("star");
	});

	it("keeps the mappedIcon entry when the command does not exist yet", () => {
		const commands = {};
		const settings = makeSettings([{ iconID: "star", commandID: "missing:command" }]);
		injectIcons(settings, makePlugin(commands));
		expect(settings.mappedIcons).toHaveLength(1);
		expect(settings.mappedIcons[0].commandID).toBe("missing:command");
	});

	it("leaves unrelated mapped icons intact", () => {
		const commands = {
			"cmd-a": { icon: "" },
			"cmd-b": { icon: "" },
		};
		const settings = makeSettings([
			{ iconID: "check", commandID: "cmd-a" },
			{ iconID: "x", commandID: "cmd-b" },
		]);
		injectIcons(settings, makePlugin(commands));
		expect(commands["cmd-a"].icon).toBe("check");
		expect(commands["cmd-b"].icon).toBe("x");
		expect(settings.mappedIcons).toHaveLength(2);
	});

	it("keeps every mapping and still applies the icons that resolve", () => {
		const commands = { "exists:cmd": { icon: "" } };
		const settings = makeSettings([
			{ iconID: "star", commandID: "missing:cmd" },
			{ iconID: "home", commandID: "exists:cmd" },
		]);
		injectIcons(settings, makePlugin(commands));
		expect(settings.mappedIcons).toHaveLength(2);
		expect(commands["exists:cmd"].icon).toBe("home");
	});
});
