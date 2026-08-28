(globalThis as Record<string, unknown>).moment = { locale: (): string => "en" };

// Obsidian augments Array.prototype with `remove`; provide it for tests.
if (!Object.prototype.hasOwnProperty.call(Array.prototype, "remove")) {
	Object.defineProperty(Array.prototype, "remove", {
		value<T>(this: T[], item: T): T[] {
			const index = this.indexOf(item);
			if (index > -1) this.splice(index, 1);
			return this;
		},
		writable: true,
		configurable: true,
	});
}

export {};
