import { Platform } from "obsidian";
import { Fragment, h } from "preact";
import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { DEFAULT_SETTINGS } from "src/constants";
import t from "src/l10n";
import { Tab } from "src/types";
import { ObsidianIcon, updateSpacing } from "src/util";
import CommanderPlugin from "../../main";
import About from "./About";
import AdvancedToolbarSettings from "./AdvancedToolbarSettings";
import CommandViewer from "./commandViewerComponent";
import { LeftRibbonHider, MenuItemHider, StatusbarHider } from "./hidingViewer";
import MacroViewer from "./MacroViewer";
import { SliderComponent, ToggleComponent } from "./settingComponent";
import TextToolbarIntegrationManager from "src/manager/commands/textToolbarIntegrationManager";

const TAB_PANEL_ID = "cmdr-tab-panel";
const tabId = (idx: number): string => `cmdr-tab-${idx}`;

export default function settingTabComponent({
	plugin,
	mobileMode,
}: {
	plugin: CommanderPlugin;
	mobileMode: boolean;
}): h.JSX.Element {
	const [activeTab, setActiveTab] = useState(0);
	const [open, setOpen] = useState(true);

	//This is used to remove the initial onclick event listener.
	if (Platform.isMobile) {
		useEffect(() => {
			const old_element = document.querySelector(
				".modal-setting-back-button"
			)!;
			const new_element = old_element.cloneNode(true);
			old_element.parentNode!.replaceChild(new_element, old_element);
			setOpen(true);
		}, []);
	}

	useEffect(() => {
		const el = document.querySelector<HTMLElement>(
			".modal-setting-back-button"
		);
		if (!el) return;

		if (!open) {
			el.parentElement!.lastChild!.textContent = tabs[activeTab].name;
			el.onclick = (): void => setOpen(true);
		} else {
			el.parentElement!.lastChild!.textContent = "Commander";
			el.onclick = (): void => plugin.app.setting.closeActiveTab();
		}
	}, [open]);

	const tabs: Tab[] = useMemo(
		() => [
			{
				name: t("General"),
				tab: (
					<Fragment>
						<ToggleComponent
							name={t("Always ask before removing?")}
							description={t(
								"Always show a Popup to confirm deletion of a Command."
							)}
							value={plugin.settings.confirmDeletion}
							changeHandler={async (value): Promise<void> => {
								plugin.settings.confirmDeletion = !value;
								await plugin.saveSettings();
							}}
						/>
						<ToggleComponent
							value={plugin.settings.showAddCommand}
							name={t('Show "Add Command" Button')}
							description={
								'Show the "Add Command" Button in every Menu.'
							}
							changeHandler={async (value): Promise<void> => {
								plugin.settings.showAddCommand = !value;
								await plugin.manager.pageHeader.reorder();
								await plugin.saveSettings();
							}}
						/>
						<SliderComponent
							value={plugin.settings.spacing}
							defaultValue={DEFAULT_SETTINGS.spacing}
							name={t(
								"Choose custom spacing for Command Buttons"
							)}
							description={t(
								"Change the spacing between commands. You can set different values on mobile and desktop."
							)}
							changeHandler={async (value): Promise<void> => {
								updateSpacing(value);
								plugin.settings.spacing = value;
								await plugin.saveSettings();
							}}
						/>

					</Fragment>
				),
			},
			{
				name: t("Left Ribbon"),
				tab: (
					<CommandViewer
						manager={plugin.manager.leftRibbon}
						plugin={plugin}
						sortable={false}
					>
						<LeftRibbonHider plugin={plugin} />
						<div
							className="cmdr-sep-con callout"
							data-callout="warning"
						>
							<span className="cmdr-callout-warning">
								<ObsidianIcon icon="alert-triangle" />{" "}
								Reordering and Sorting
							</span>
							<p className="cmdr-warning-description">
								As of Obsidian 1.1.0 you can reorder the Buttons
								in the left ribbon by dragging. This will
								replace the old sorting feature.
							</p>
						</div>
					</CommandViewer>
				),
			},
			// {
			// 	name: t("Right Ribbon"),
			// 	tab: <CommandViewer manager={plugin.manager.rightRibbon} plugin={plugin} />
			// },
			{
				name: t("Page Header"),
				tab: (
					<CommandViewer
						manager={plugin.manager.pageHeader}
						plugin={plugin}
					>
						<hr />
						<div
							className="cmdr-sep-con callout"
							data-callout="warning"
						>
							<span className="cmdr-callout-warning">
								<ObsidianIcon icon="alert-triangle" />{" "}
								{t("Warning")}
							</span>
							<p className="cmdr-warning-description">
								{t(
									"As of Obsidian 0.16.0 you need to explicitly enable the View Header."
								)}
							</p>
							<button
								onClick={(): void => {
									plugin.app.setting.openTabById("appearance");
									window.setTimeout(() => {
										plugin.app.setting.activeTab.containerEl.scroll(
											{
												behavior: "smooth",
												top: 250,
											}
										);

										(
											plugin.app.setting.activeTab.containerEl
												.querySelectorAll(
													".setting-item-heading"
												)[1]
												.nextSibling?.nextSibling
												?.nextSibling as HTMLElement | null
										)?.addClass?.("cmdr-cta");
									}, 50);
								}}
								className="mod-cta"
							>
								{t("Open Appearance Settings")}
							</button>
						</div>
					</CommandViewer>
				),
			},
			// {
			// 	name: t("Titlebar"),
			// 	tab: <CommandViewer manager={plugin.manager.titleBar} plugin={plugin} />
			// },
			{
				name: t("Statusbar"),
				tab: (
					<CommandViewer
						manager={plugin.manager.statusBar}
						plugin={plugin}
					>
						<StatusbarHider plugin={plugin} />
					</CommandViewer>
				),
			},
			{
				name: t("Editor Menu"),
				tab: (
					<CommandViewer
						manager={plugin.manager.editorMenu}
						plugin={plugin}
					>
						<MenuItemHider
							plugin={plugin}
							scope="editorMenuItems"
						/>
					</CommandViewer>
				),
			},
			{
				name: t("File Menu"),
				tab: (
					<CommandViewer
						manager={plugin.manager.fileMenu}
						plugin={plugin}
					>
						<MenuItemHider plugin={plugin} scope="fileMenuItems" />
					</CommandViewer>
				),
			},
			{
				name: t("Explorer"),
				tab: (
					<CommandViewer
						manager={plugin.manager.explorerManager}
						plugin={plugin}
					>
						<hr />
						<div
							className="cmdr-sep-con callout"
							data-callout="warning"
						>
							<span className="cmdr-callout-warning">
								<ObsidianIcon icon="alert-triangle" />{" "}
								{t("Warning")}
							</span>
							<p className="cmdr-warning-description">
								{
									"When clicking on a Command in the Explorer, the Explorer view will become focused. This might interfere with Commands that are supposed to be executed on an active File/Explorer."
								}
							</p>
						</div>
					</CommandViewer>
				),
			},

			...(TextToolbarIntegrationManager.isAvailable(plugin)
				? [
					{
						name: "Text Toolbar",
						tab: (
							<CommandViewer
								manager={plugin.manager.textToolbarIntegration}
								plugin={plugin}
							/>
						),
					},
				]
				: []),
			{
				name: Platform.isMobile ? "Mobile Toolbar" : "Toolbar",
				tab: <AdvancedToolbarSettings plugin={plugin} />,
			},
			{
				name: "Macros",
				tab: (
					<MacroViewer
						plugin={plugin}
						macros={plugin.settings.macros}
					/>
				),
			},
		],
		[]
	);

	return (
		<Fragment>
			{Platform.isDesktop && (
				<div className="cmdr-setting-title">
					<h1>{plugin.manifest.name}</h1>
				</div>
			)}

			{(Platform.isDesktop || open) && (
				<TabHeader
					tabs={tabs}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
					setOpen={setOpen}
				/>
			)}

			<div
				class={`cmdr-setting-content ${
					mobileMode ? "cmdr-mobile" : ""
				}`}
				id={TAB_PANEL_ID}
				role="tabpanel"
				aria-labelledby={tabId(activeTab)}
			>
				{(Platform.isDesktop || !open) && tabs[activeTab].tab}

				{((Platform.isMobile && open) ||
					(Platform.isDesktop && activeTab === 0)) && (
					<About manifest={plugin.manifest} />
				)}
			</div>
		</Fragment>
	);
}

interface TabHeaderProps {
	tabs: Tab[];
	activeTab: number;
	setActiveTab: (idx: number) => void;
	setOpen: (open: boolean) => void;
}
export function TabHeader({
	tabs,
	activeTab,
	setActiveTab,
	setOpen,
}: TabHeaderProps): h.JSX.Element {
	const wrapper = useRef<HTMLElement>(null);
	const group = useRef<HTMLDivElement>(null);
	const indicator = useRef<HTMLSpanElement>(null);
	const indicatorPlaced = useRef(false);
	const [fadeLeft, setFadeLeft] = useState(false);
	const [fadeRight, setFadeRight] = useState(false);

	const selectTab = (idx: number): void => {
		setActiveTab(idx);
		setOpen(false);
	};

	const handleScroll = (e: WheelEvent): void => {
		const el = wrapper.current;
		// Horizontal gestures (touchpad swipes, shift+wheel) scroll natively
		if (!el || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
		// Nothing to scroll: let the settings page scroll vertically
		if (el.scrollWidth <= el.clientWidth) return;

		e.preventDefault();
		const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
		el.scrollLeft += e.deltaY * unit;
	};

	// Fade an edge only while there are more tabs hidden past it
	const updateFades = (): void => {
		const el = wrapper.current;
		if (!el) return;
		setFadeLeft(el.scrollLeft > 1);
		setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
	};

	const moveIndicator = (animate: boolean): void => {
		const bar = indicator.current;
		const tab = group.current?.querySelector<HTMLElement>(".cmdr-tab-active");
		if (!bar || !tab) return;

		bar.toggleClass("cmdr-no-transition", !animate);
		bar.setCssProps({
			"--cmdr-indicator-x": `${tab.offsetLeft}px`,
			"--cmdr-indicator-width": `${tab.offsetWidth}px`,
		});
		if (!animate) {
			void bar.offsetWidth; // flush the jump before restoring transitions
			bar.removeClass("cmdr-no-transition");
		}
	};

	useEffect(() => {
		const el = wrapper.current;
		if (!el || Platform.isMobile) {
			return;
		}

		const onResize = (): void => {
			updateFades();
			moveIndicator(false);
		};
		const observer = new ResizeObserver(onResize);
		observer.observe(el);
		if (group.current) observer.observe(group.current);

		el.addEventListener("wheel", handleScroll);
		el.addEventListener("scroll", updateFades, { passive: true });
		return (): void => {
			observer.disconnect();
			el.removeEventListener("wheel", handleScroll);
			el.removeEventListener("scroll", updateFades);
		};
	}, []);

	useLayoutEffect(() => {
		if (Platform.isMobile) return;
		moveIndicator(indicatorPlaced.current);
		indicatorPlaced.current = true;
	}, [activeTab]);

	useEffect(
		() =>
			wrapper.current
				?.querySelector(".cmdr-tab-active")
				?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
		[activeTab]
	);

	const handleKeyDown = (e: KeyboardEvent): void => {
		const els = Array.from(
			group.current?.querySelectorAll<HTMLElement>(".cmdr-tab") ?? []
		);
		const current = els.indexOf(document.activeElement as HTMLElement);
		if (current === -1) return;

		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			selectTab(current);
			return;
		}

		const prevKey = Platform.isMobile ? "ArrowUp" : "ArrowLeft";
		const nextKey = Platform.isMobile ? "ArrowDown" : "ArrowRight";
		let target: number;
		switch (e.key) {
			case prevKey:
				target = (current - 1 + els.length) % els.length;
				break;
			case nextKey:
				target = (current + 1) % els.length;
				break;
			case "Home":
				target = 0;
				break;
			case "End":
				target = els.length - 1;
				break;
			default:
				return;
		}

		e.preventDefault();
		els[target].focus();
		// On mobile, selecting a tab navigates away, so arrows only move focus
		if (Platform.isDesktop) setActiveTab(target);
	};

	return (
		<nav
			class={`cmdr-setting-header ${
				Platform.isMobile ? "cmdr-mobile" : ""
			} ${fadeLeft ? "cmdr-fade-left" : ""} ${
				fadeRight ? "cmdr-fade-right" : ""
			}`}
			ref={wrapper}
		>
			<div
				class={`cmdr-setting-tab-group ${
					Platform.isMobile ? "vertical-tab-header-group-items" : ""
				}`}
				ref={group}
				role="tablist"
				aria-orientation={Platform.isMobile ? "vertical" : "horizontal"}
				onKeyDown={handleKeyDown}
			>
				{tabs.map((tab, idx) => (
					<div
						className={`cmdr-tab ${
							activeTab === idx ? "cmdr-tab-active" : ""
						} ${Platform.isMobile ? "vertical-tab-nav-item" : ""}`}
						id={tabId(idx)}
						role="tab"
						aria-selected={activeTab === idx}
						aria-controls={TAB_PANEL_ID}
						tabIndex={activeTab === idx ? 0 : -1}
						onClick={(): void => selectTab(idx)}
					>
						{tab.name}
						{Platform.isMobile && (
							<ObsidianIcon
								className="vertical-tab-nav-item-chevron cmdr-block"
								icon="chevron-right"
								size={24}
							/>
						)}
					</div>
				))}
				{Platform.isDesktop && (
					<span
						className="cmdr-tab-indicator"
						ref={indicator}
						aria-hidden="true"
					/>
				)}
			</div>

			{Platform.isDesktop && <div className="cmdr-fill" />}
		</nav>
	);
}
