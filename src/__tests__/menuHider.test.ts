import { describe, it, expect } from "vitest";
import {
	compileMatchers,
	isInvalidPattern,
	isSlashWrapped,
	titleMatches,
} from "../manager/menuHiderManager";

function matches(patterns: string[], title: string): boolean {
	return titleMatches(title, compileMatchers(patterns));
}

describe("compileMatchers / titleMatches", () => {
	it("matches an exact name case-insensitively", () => {
		expect(matches(["Copy"], "copy")).toBe(true);
		expect(matches(["copy"], "COPY")).toBe(true);
		expect(matches(["Copy"], "Copy path")).toBe(false);
	});

	it("does not substring-match plain entries", () => {
		expect(matches(["Open"], "Open in default app")).toBe(false);
	});

	it("treats a slash-wrapped entry as a regular expression", () => {
		expect(matches(["/^Open in default app$/"], "Open in default app")).toBe(
			true
		);
		expect(matches(["/^paste/i"], "Paste as plain text")).toBe(true);
		expect(matches(["/Paste/"], "Paste as plain text")).toBe(true);
		expect(matches(["/paste/"], "Paste as plain text")).toBe(false); // no i flag, capital P
	});

	it("ignores blank and whitespace-only entries", () => {
		expect(compileMatchers(["", "   ", "\t"])).toHaveLength(0);
	});

	it("trims entries before compiling", () => {
		expect(matches(["  Copy  "], "copy")).toBe(true);
	});

	it("drops an uncompilable regex instead of throwing", () => {
		expect(() => compileMatchers(["/(/"])).not.toThrow();
		expect(compileMatchers(["/(/"])).toHaveLength(0);
	});

	it("drops an empty-body regex instead of matching everything", () => {
		expect(compileMatchers(["//"])).toHaveLength(0);
		expect(matches(["//"], "Copy")).toBe(false);
		expect(matches(["/ /"], "a b")).toBe(true); // a space body is still valid
	});

	it("returns false for an empty title", () => {
		expect(matches(["/.*/"], "")).toBe(false);
	});

	it("combines multiple patterns", () => {
		const list = ["Copy", "/^paste/i"];
		expect(matches(list, "Copy")).toBe(true);
		expect(matches(list, "Paste")).toBe(true);
		expect(matches(list, "Cut")).toBe(false);
	});
});

describe("isInvalidPattern", () => {
	it("flags a slash-wrapped entry that does not compile", () => {
		expect(isInvalidPattern("/(/")).toBe(true);
		expect(isInvalidPattern("/a{2,1}/")).toBe(true);
	});

	it("flags an empty-body regex literal", () => {
		expect(isInvalidPattern("//")).toBe(true);
		expect(isInvalidPattern("  //  ")).toBe(true);
		expect(isInvalidPattern("//gi")).toBe(true);
	});

	it("accepts a valid regex literal", () => {
		expect(isInvalidPattern("/^Open in default app$/i")).toBe(false);
		expect(isInvalidPattern("/ /")).toBe(false);
	});

	it("treats a plain string as valid (not a regex literal)", () => {
		expect(isInvalidPattern("Copy")).toBe(false);
		expect(isInvalidPattern("Paste (plain)")).toBe(false);
	});
});

describe("isSlashWrapped", () => {
	it("recognises a regex literal, trimmed", () => {
		expect(isSlashWrapped("/foo/i")).toBe(true);
		expect(isSlashWrapped("  /foo/  ")).toBe(true);
		expect(isSlashWrapped("//")).toBe(true);
	});

	it("rejects plain strings", () => {
		expect(isSlashWrapped("Copy")).toBe(false);
		expect(isSlashWrapped("/only-one-slash")).toBe(false);
		expect(isSlashWrapped("/bad/flags-x")).toBe(false);
	});
});
