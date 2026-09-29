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

/**
 * SPIKE: declarative replacements for `hidingViewer.tsx`.
 *
 * Each row is a native `toggle` control where ON means the item is *shown*
 * (matching Obsidian's own toggles); the stored `hide.*` lists still hold the
 * hidden entries. The toggle's key encodes the list and entry it edits
 * (`hide|<list>|<entry>`), and the settings tab routes those keys to
 * `isShown` / `setShown`, inverting the value.
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
		name: "Hide other Commands",
		desc: "Turn off to hide ribbon icons added by Obsidian or other plugins.",
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
				description: "Core Plugin",
			} as PluginManifest)
	);

	return {
		type: "page",
		name: "Hide other Commands",
		desc: "Turn off to hide status bar items added by Obsidian or other plugins.",
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
			heading: "Hide menu items",
			items: [
				{
					name: "Add entry",
					desc: "Remove items from this menu by exact name (case-insensitive), or by a regular expression wrapped in slashes, e.g. /^Open in default app$/i.",
					render: (setting): void => {
						let draft = "";
						const add = async (): Promise<void> => {
							const value = draft.trim();
							if (!value || list.includes(value)) return;
							list.push(value);
							await persist();
						};
						setting.addText((text) => {
							text.setPlaceholder("Menu item name or /regex/").onChange(
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
							btn.setButtonText("Add").setCta().onClick(add)
						);
					},
				},
				...titles.map((title) => showRow(scope, title, title)),
			],
		},
		{
			type: "list",
			heading: "Regular expressions",
			emptyState:
				"Open this menu once and its items appear above; turn a toggle off to hide it. Regexes you add are always applied.",
			items: patterns.map((entry) => ({
				name: entry,
				desc: isInvalidPattern(entry)
					? "Invalid regular expression — this entry is ignored."
					: undefined,
			})),
			onDelete: (index): void => {
				list.remove(patterns[index]);
				void persist();
			},
		},
	];
}
