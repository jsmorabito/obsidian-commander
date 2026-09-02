import { PluginManifest } from "obsidian";
import { Fragment, h } from "preact";
import { useEffect, useState } from "preact/hooks";
import t from "src/l10n";
import CommanderPlugin from "src/main";
import { updateHiderStylesheet, ObsidianIcon } from "src/util";
import {
	isInvalidPattern,
	isSlashWrapped,
	type MenuScope,
} from "src/manager/menuHiderManager";
import Accordion from "./Accordion";
import { EyeToggleComponent } from "./settingComponent";

export function LeftRibbonHider({
	plugin,
}: {
	plugin: CommanderPlugin;
}): h.JSX.Element {
	const [ribbonCommands, setRibbonCommands] = useState<
		{ name: string; icon: string }[]
	>([]);
	const hiddenCommands = plugin.settings.hide.leftRibbon;
	useEffect(() => {
		setRibbonCommands(
			plugin.app.workspace.leftRibbon.items.map((item) => ({
				name: item.title,
				icon: item.icon,
			}))
		);
	}, []);

	return (
		<Fragment>
			<hr />
			<Accordion title={t("Hide other Commands")}>
				{ribbonCommands.map((command) => (
					<EyeToggleComponent
						name={command.name}
						description=""
						hideLabel={t("Hide")}
						showLabel={t("Show")}
						changeHandler={async (value): Promise<void> => {
							if (!value) {
								hiddenCommands.push(command.name);
							} else {
								hiddenCommands.contains(command.name) &&
									hiddenCommands.remove(command.name);
							}
							updateHiderStylesheet(plugin.settings);
							await plugin.saveSettings();
						}}
						value={hiddenCommands.contains(command.name)}
					/>
				))}
			</Accordion>
		</Fragment>
	);
}

export function StatusbarHider({
	plugin,
}: {
	plugin: CommanderPlugin;
}): h.JSX.Element {
	const hiddenPlugins = plugin.settings.hide.statusbar;
	const [pluginsWithRibbonItems, setPluginsWithRibbonItems] = useState<
		PluginManifest[]
	>([]);
	useEffect(() => {
		const statusBarItems = [
			...plugin.app.statusBar.containerEl.getElementsByClassName(
				"status-bar-item"
			),
		];
		const ids = (
			statusBarItems
				.map((el) =>
					[...el.classList].find((pre) => pre.startsWith("plugin-"))
				)
				.filter((pre) => pre) as string[]
		).map((pre) => pre.substring(7));
		setPluginsWithRibbonItems(
			ids.map(
				(id) =>
					plugin.app.plugins.manifests[id] || {
						id,
						name: id
							.replace(/-/g, " ")
							.replace(/(^\w{1})|(\s+\w{1})/g, (letter) =>
								letter.toUpperCase()
							),
						description: "Core Plugin",
					}
			)
		);
	}, []);

	return (
		<Fragment>
			<hr />
			<Accordion title={t("Hide other Commands")}>
				{pluginsWithRibbonItems.map((manifest) => (
					<EyeToggleComponent
						name={manifest.name}
						description={manifest.description}
						value={hiddenPlugins.contains(manifest.id)}
						hideLabel={t("Hide")}
						showLabel={t("Show")}
						changeHandler={async (value): Promise<void> => {
							if (!value) {
								hiddenPlugins.push(manifest.id);
							} else {
								hiddenPlugins.contains(manifest.id) &&
									hiddenPlugins.remove(manifest.id);
							}
							updateHiderStylesheet(plugin.settings);
							await plugin.saveSettings();
						}}
					/>
				))}
			</Accordion>
		</Fragment>
	);
}

export function MenuItemHider({
	plugin,
	scope,
}: {
	plugin: CommanderPlugin;
	scope: MenuScope;
}): h.JSX.Element {
	const list = plugin.settings.hide[scope];
	const [, setTick] = useState(0);
	const rerender = (): void => setTick((tick) => tick + 1);
	const [draft, setDraft] = useState("");
	const [seen, setSeen] = useState<string[]>([]);

	useEffect(() => {
		// The checklist is built from titles seen in real menus; refresh as
		// more are opened while this tab is visible.
		setSeen(plugin.manager.menuHider.getSeen(scope));
		return plugin.manager.menuHider.onChange(() => {
			setSeen(plugin.manager.menuHider.getSeen(scope));
		});
	}, [scope]);

	const persist = async (): Promise<void> => {
		plugin.manager.menuHider.recompile();
		await plugin.saveSettings();
		rerender();
	};

	const addEntry = async (): Promise<void> => {
		const value = draft.trim();
		if (!value || list.includes(value)) {
			setDraft("");
			return;
		}
		list.push(value);
		setDraft("");
		await persist();
	};

	const setHidden = async (title: string, hidden: boolean): Promise<void> => {
		if (hidden && !list.includes(title)) list.push(title);
		if (!hidden && list.includes(title)) list.remove(title);
		await persist();
	};

	// Plain-string entries render as toggles; regex entries as editable rows.
	const patternEntries = list.filter(isSlashWrapped);
	const toggleTitles = [
		...new Set([...seen, ...list.filter((e) => !isSlashWrapped(e))]),
	].sort((a, b) => a.localeCompare(b));

	const content: h.JSX.Element[] = [
		<p className="cmdr-menu-hider-description" key="cmdr-mh-desc">
			{t(
				"Remove items from this menu by their exact name (case-insensitive), or by a regular expression wrapped in slashes, e.g. /^Open in default app$/i."
			)}
		</p>,
		<div className="cmdr-menu-hider-add" key="cmdr-mh-add">
			<input
				type="text"
				placeholder={t("Menu item name or /regex/")}
				value={draft}
				onInput={(e): void =>
					setDraft((e.target as HTMLInputElement).value)
				}
				onKeyDown={(e): void => {
					if (e.key === "Enter") {
						e.preventDefault();
						void addEntry();
					}
				}}
			/>
			<button className="mod-cta" onClick={(): void => void addEntry()}>
				{t("Add")}
			</button>
		</div>,
	];

	for (const entry of patternEntries) {
		const invalid = isInvalidPattern(entry);
		content.push(
			<div className="setting-item cmdr-menu-hider-row" key={`re:${entry}`}>
				<div className="setting-item-info">
					<code
						className={invalid ? "cmdr-menu-hider-invalid" : ""}
					>
						{entry}
					</code>
					{invalid && (
						<div className="setting-item-description cmdr-menu-hider-invalid">
							{t(
								"Invalid regular expression — this entry is ignored."
							)}
						</div>
					)}
				</div>
				<div className="setting-item-control">
					<ObsidianIcon
						icon="trash"
						size={16}
						className="clickable-icon"
						aria-label={t("Remove")}
						onClick={async (): Promise<void> => {
							list.remove(entry);
							await persist();
						}}
					/>
				</div>
			</div>
		);
	}

	content.push(
		<div className="cmdr-menu-hider-hint" key="cmdr-mh-hint">
			<ObsidianIcon icon="info" size={14} />
			<span>
				{t(
					"Open this menu once and its items will appear here to toggle. Regexes and names typed above are always applied."
				)}
			</span>
		</div>
	);

	for (const title of toggleTitles) {
		const hidden = list.includes(title);
		content.push(
			// The hidden state is part of the key so the toggle remounts (and
			// re-reads `value`) when the list changes from elsewhere, e.g. the
			// same name typed into the add field. EyeToggleComponent latches
			// `value` on mount and would otherwise show a stale state.
			<EyeToggleComponent
				key={`t:${hidden ? "1" : "0"}:${title}`}
				name={title}
				description=""
				hideLabel={t("Hide")}
				showLabel={t("Show")}
				value={hidden}
				changeHandler={(wasHidden): void => {
					void setHidden(title, !wasHidden);
				}}
			/>
		);
	}

	return (
		<Fragment>
			<hr />
			<Accordion title={t("Hide menu items")}>{content}</Accordion>
		</Fragment>
	);
}
