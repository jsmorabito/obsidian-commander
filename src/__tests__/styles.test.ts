import { describe, it, expect, beforeEach } from "vitest";
import { updateStyles, removeStyles, updateSpacing } from "../util";
import type { AdvancedToolbarSettings } from "../types";

const defaultSettings: AdvancedToolbarSettings = {
	rowHeight: 48,
	rowCount: 1,
	spacing: 4,
	buttonWidth: 48,
	columnLayout: false,
	mappedIcons: [],
	tooltips: false,
	heightOffset: 0,
};

beforeEach(() => {
	document.body.className = "";
	document.body.removeAttribute("style");
});

describe("updateStyles", () => {
	it("sets CSS custom properties on document.body", () => {
		updateStyles(defaultSettings);
		const s = document.body.style;
		expect(s.getPropertyValue("--at-button-height")).toBe("48px");
		expect(s.getPropertyValue("--at-button-width")).toBe("48px");
		expect(s.getPropertyValue("--at-row-count")).toBe("1");
		expect(s.getPropertyValue("--at-spacing")).toBe("4px");
		expect(s.getPropertyValue("--at-offset")).toBe("0px");
	});

	it("adds AT-row class when columnLayout is false", () => {
		updateStyles({ ...defaultSettings, columnLayout: false });
		expect(document.body.classList.contains("AT-row")).toBe(true);
		expect(document.body.classList.contains("AT-column")).toBe(false);
	});

	it("adds AT-column class when columnLayout is true", () => {
		updateStyles({ ...defaultSettings, columnLayout: true });
		expect(document.body.classList.contains("AT-column")).toBe(true);
		expect(document.body.classList.contains("AT-row")).toBe(false);
	});

	it("adds AT-multirow when rowCount > 1", () => {
		updateStyles({ ...defaultSettings, rowCount: 3 });
		expect(document.body.classList.contains("AT-multirow")).toBe(true);
	});

	it("does not add AT-multirow when rowCount === 1", () => {
		updateStyles(defaultSettings);
		expect(document.body.classList.contains("AT-multirow")).toBe(false);
	});

	it("adds AT-no-toolbar when rowCount === 0", () => {
		updateStyles({ ...defaultSettings, rowCount: 0 });
		expect(document.body.classList.contains("AT-no-toolbar")).toBe(true);
	});
});

describe("removeStyles", () => {
	it("removes CSS custom properties set by updateStyles", () => {
		updateStyles(defaultSettings);
		removeStyles();
		const s = document.body.style;
		expect(s.getPropertyValue("--at-button-height")).toBe("");
		expect(s.getPropertyValue("--at-button-width")).toBe("");
		expect(s.getPropertyValue("--at-row-count")).toBe("");
		expect(s.getPropertyValue("--at-spacing")).toBe("");
		expect(s.getPropertyValue("--at-offset")).toBe("");
	});

	it("removes layout classes set by updateStyles", () => {
		updateStyles({ ...defaultSettings, rowCount: 2, columnLayout: true });
		removeStyles();
		expect(document.body.classList.contains("AT-multirow")).toBe(false);
		expect(document.body.classList.contains("AT-row")).toBe(false);
		expect(document.body.classList.contains("AT-column")).toBe(false);
	});

	it("clears the custom-spacing var and class", () => {
		updateSpacing(12);
		removeStyles();
		expect(document.body.style.getPropertyValue("--cmdr-spacing")).toBe("");
		expect(document.body.classList.contains("cmdr-custom-spacing")).toBe(
			false
		);
	});
});

describe("updateSpacing", () => {
	it("sets the var and gating class for a positive value", () => {
		updateSpacing(16);
		expect(document.body.style.getPropertyValue("--cmdr-spacing")).toBe(
			"16px"
		);
		expect(document.body.classList.contains("cmdr-custom-spacing")).toBe(
			true
		);
	});

	it("adds nothing at 0 so native spacing is untouched", () => {
		updateSpacing(0);
		expect(document.body.style.getPropertyValue("--cmdr-spacing")).toBe("");
		expect(document.body.classList.contains("cmdr-custom-spacing")).toBe(
			false
		);
	});

	it("clears a previously-set value when returning to 0", () => {
		updateSpacing(16);
		updateSpacing(0);
		expect(document.body.style.getPropertyValue("--cmdr-spacing")).toBe("");
		expect(document.body.classList.contains("cmdr-custom-spacing")).toBe(
			false
		);
	});
});
