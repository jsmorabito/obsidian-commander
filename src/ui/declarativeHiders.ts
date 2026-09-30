import {
	PluginManifest,
	SettingDefinitionItem,
	SettingDefinitionPage,
	SettingGroupItem,
} from "obsidian";
import CommanderPlugin from "../main";
import {
	isInvalidPattern,
	isSlashWrapped,
	MenuScope,
} from "../manager/menuHiderManager";
import { updateHiderStylesheet } from "../util";
import t from "../l10n";

/**
 * Hiders for native ribbon icons, status bar items and right-click menu items.
 * Rows are native toggles where ON = shown; keys are `hide|<list>|<entry>`,
 * routed by the settings tab to `isShown` / `setShown`.
 */

export type HideList = "leftRibbon" | "statusbar" | MenuScope;

const PREFIX = "hide|";

const hideKey = (list: HideList, entry: string): string =>
	`${PREFIX}${list}|${entry}`;

export const isHideKey = (key: string): boolean => key.startsWith(PREFIX);

function parseHideKey(key: string): { list: HideList; entry: string } {
	const rest = key.substring(PREFIX.length);
	const sep = rest.indexOf("|");
	return {
		list: rest.substring(0, sep) as HideList,
		entry: rest.substring(sep + 1),
	};
}

export function isShown(plugin: CommanderPlugin, key: string): boolean {
	const { list, entry } = parseHideKey(key);
	return !plugin.settings.hide[list].includes(entry);
}

export async function setShown(
	plugin: CommanderPlugin,
	key: string,
	shown: boolean
): Promise<void> {
	const { list, entry } = parseHideKey(key);
	const entries = plugin.settings.hide[list];
	if (!shown && !entries.includes(entry)) entries.push(entry);
	if (shown && entries.includes(entry)) entries.remove(entry);

	if (list === "leftRibbon" || list === "statusbar") {
		updateHiderStylesheet(plugin.settings);
	} else {
		plugin.manager.menuHider.recompile();
	}
	await plugin.saveSettings();
}

/** A native toggle row: on = shown, off = hidden. */
function showRow(
	list: HideList,
	entry: string,
	name: string,
	desc?: string
): SettingGroupItem {
	return {
		name,
		desc,
		control: { type: "toggle", key: hideKey(list, entry) },
	};
}

/** Ribbon icons other plugins added, as a show/hide toggle each. */
export function ribbonHiderPage(
	plugin: CommanderPlugin
): SettingDefinitionPage {
	return {
		type: "page",
		name: t("Hide other Commands"),
		desc: t(
			"Turn off to hide ribbon icons added by Obsidian or other plugins."
		),
		items: [
			{
				type: "group",
				items: plugin.app.workspace.leftRibbon.items.map((item) =>
					showRow("leftRibbon", item.title, item.title)
				),
			},
		],
	};
}

/** Status bar items other plugins added, as a show/hide toggle each. */
export function statusbarHiderPage(
	plugin: CommanderPlugin
): SettingDefinitionPage {
	const ids = [
		...plugin.app.statusBar.containerEl.getElementsByClassName(
			"status-bar-item"
		),
	]
		.map((el) => [...el.classList].find((c) => c.startsWith("plugin-")))
		.filter((c): c is string => !!c)
		.map((c) => c.substring(7));

	const manifests: PluginManifest[] = ids.map(
		(id) =>
			plugin.app.plugins.manifests[id] ||
			({
				id,
				name: id
					.replace(/-/g, " ")
					.replace(/(^\w{1})|(\s+\w{1})/g, (l) => l.toUpperCase()),
				description: t("Core Plugin"),
			} as PluginManifest)
	);

	return {
		type: "page",
		name: t("Hide other Commands"),
		desc: t(
			"Turn off to hide status bar items added by Obsidian or other plugins."
		),
		items: [
			{
				type: "group",
				items: manifests.map((m) =>
					showRow("statusbar", m.id, m.name, m.description)
				),
			},
		],
	};
}

/**
 * Right-click menu hider: a free-text/regex add field, a deletable list of
 * regex entries, and a show/hide toggle per menu item title seen in real menus.
 */
export function menuHiderItems(
	plugin: CommanderPlugin,
	scope: MenuScope,
	update: () => void
): SettingDefinitionItem[] {
	const list = plugin.settings.hide[scope];
	const persist = async (): Promise<void> => {
		plugin.manager.menuHider.recompile();
		await plugin.saveSettings();
		update();
	};

	const patterns = list.filter(isSlashWrapped);
	const titles = [
		...new Set([
			...plugin.manager.menuHider.getSeen(scope),
			...list.filter((e) => !isSlashWrapped(e)),
		]),
	].sort((a, b) => a.localeCompare(b));

	return [
		{
			type: "group",
			heading: t("Hide menu items"),
			items: [
				{
					name: t("Add entry"),
					desc: t(
						"Remove items from this menu by their exact name (case-insensitive), or by a regular expression wrapped in slashes, e.g. /^Open in default app$/i."
					),
					render: (setting): void => {
						let draft = "";
						const add = async (): Promise<void> => {
							const value = draft.trim();
							if (!value || list.includes(value)) return;
							list.push(value);
							await persist();
						};
						setting.addText((text) => {
							text.setPlaceholder(t("Menu item name or /regex/")).onChange(
								(v) => (draft = v)
							);
							text.inputEl.addEventListener("keydown", (e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									void add();
								}
							});
						});
						setting.addButton((btn) =>
							btn.setButtonText(t("Add")).setCta().onClick(add)
						);
					},
				},
				// Hint for the toggles below.
				{
					name: t(
						"Open this menu once and its items will appear here to toggle. Regexes and names typed above are always applied."
					),
				},
				...titles.map((title) => showRow(scope, title, title)),
			],
		},
		{
			type: "list",
			heading: t("Regular expressions"),
			emptyState: t("No regular expressions added."),
			items: patterns.map((entry) => ({
				name: entry,
				desc: isInvalidPattern(entry)
					? t("Invalid regular expression — this entry is ignored.")
					: undefined,
			})),
			onDelete: (index): void => {
				list.remove(patterns[index]);
				void persist();
			},
		},
	];
}
