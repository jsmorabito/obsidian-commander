import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");
const en = JSON.parse(
	readFileSync(path.resolve(SRC_DIR, "../locale/en.json"), "utf-8")
) as Record<string, string>;

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			return name === "__tests__" ? [] : sourceFiles(full);
		}
		return /\.tsx?$/.test(name) ? [full] : [];
	});
}

// Matches t("literal"), t('literal') and t(`literal`) (no ${} interpolation).
// Calls like t("x".replace(...)) or t(variable) are intentionally skipped.
const T_CALL =
	/(?<![\w.$])t\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\$]|\\.)*)`)\s*[,)]/gs;

function unescape(literal: string): string {
	return literal.replace(/\\(["'`\\])/g, "$1");
}

describe("t() keys", () => {
	it("every literal passed to t() exists in locale/en.json", () => {
		const missing: string[] = [];
		for (const file of sourceFiles(SRC_DIR)) {
			const text = readFileSync(file, "utf-8");
			for (const match of text.matchAll(T_CALL)) {
				const key = unescape(
					match[1] ?? match[2] ?? match[3] ?? ""
				);
				if (!(key in en)) {
					missing.push(
						`${path.relative(SRC_DIR, file)}: ${JSON.stringify(key)}`
					);
				}
			}
		}
		// A missing key makes t() return undefined, which renders as blank text.
		expect(missing, "Keys missing from locale/en.json").toEqual([]);
	});
});
