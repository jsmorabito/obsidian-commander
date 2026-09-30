# Obsidian community plugin

## Project overview

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: npm** (required - `package.json` defines npm scripts and dependencies).
- **Bundler: esbuild** (required - `esbuild.config.mjs` and build scripts depend on it).
- Types: `obsidian` type definitions.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev:esbuild
```

### Production build

```bash
npm run build:esbuild
```

## Linting

- ESLint is preconfigured.
- Run `npm run lint` (if available) to lint the project.

## File & folder conventions

- Source lives in `src/`. Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands).
- **Current structure**:
    ```
    src/
      main.ts                        # Plugin entry point, lifecycle management
      types.ts                       # TypeScript interfaces and types
      constants.ts                   # Default settings, static data
      l10n.ts                        # Localization (t() function)
      util.tsx                       # Utility functions and Preact helpers
      manager/commands/              # Feature managers (one per UI location)
        commandManager.ts            # Abstract base class
        leftRibbonManager.ts
        statusBarManager.ts
        pageHeaderManager.ts
        menuManager.ts
        explorerManager.ts
        textToolbarManager.ts        # Text selection toolbar (new)
        index.ts
      ui/
        settingTab.ts                # Declarative settings tab (getSettingDefinitions)
        declarativeCommandList.ts    # Shared command list (add/delete/reorder/edit rows)
        declarativeHiders.ts         # Hide native ribbon/status bar/menu items
        declarativeToolbar.ts        # Mobile toolbar page
        declarativeMacros.ts         # Macros page
        icons.ts
        addCommandModal.ts
        chooseIconModal.ts
        chooseCustomNameModal.ts
        confirmDeleteModal.ts
        mobileModifyModal.ts         # Mobile row editor (rename/icon/mode/color)
        components/                  # Preact, used only inside modals and the About row
          About.tsx                  # About block, mounted in a render row
          MacroBuilder.tsx           # Macro builder (inside MacroBuilderModal)
          settingComponent.tsx       # SliderComponent (used by MacroBuilder)
      styles/
        styles.scss
        advanced-toolbar.scss
    locale/                          # Translation JSON files (en.json is canonical)
    ```
- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or other generated files.

## Key architectural patterns

### Manager pattern
Each UI location (ribbon, status bar, page header, editor menu, etc.) has a manager class that extends `CommandManagerBase`. Managers:
- Own the `CommandIconPair[]` array for their location
- Implement `addCommand`, `removeCommand`, `reorder`
- Handle DOM creation and updates for their location
- Are initialized in `main.ts` `onload()` and stored on `plugin.manager`

### Settings storage
Settings are persisted via `plugin.loadData()` / `plugin.saveData()`. The `CommanderSettings` interface in `types.ts` is the source of truth. Always add a nullish guard in `onload()` for any new optional array field so that users upgrading from older versions don't get errors:
```typescript
this.settings.hide.textToolbar ??= [];
```

### Localization
All user-visible strings should go through `t()` from `src/l10n.ts`. The canonical locale is `locale/en.json`. If you add a new UI string, add it to `en.json` **and to every non-empty locale file** (use the English text as a placeholder until it is translated): `src/__tests__/locales.test.ts` fails if a filled locale is missing a key. Empty stub locales fall back to `en.json`. If a key is not in `en.json`, `t()` returns `undefined`, which renders as blank text; `src/__tests__/l10nKeys.test.ts` fails when a `t("literal")` in `src/` is not an `en.json` key. Note that `fa.json` uses CRLF line endings; preserve them when editing.

### Settings UI (declarative)
The settings tab (`src/ui/settingTab.ts`) is declarative (Obsidian 1.13+): `getSettingDefinitions()` returns groups, pages and lists, and Obsidian renders them and indexes them for the global settings search. There is no `display()`. Prefer native `control` definitions (toggle, slider, number, dropdown, text); use a `render` callback only when a native control can't express it (e.g. a slider with a reset button, rows with several buttons).

- Controls read and write through `getControlValue` / `setControlValue` on the tab. Plain keys map to `plugin.settings`; keys with a prefix are routed to a helper (`hide|<list>|<entry>` in `declarativeHiders.ts`, `toolbar|<field>` in `declarativeToolbar.ts`).
- Command locations (ribbon, status bar, page header, menus, explorer, text toolbar) all use `commandListDefinition(plugin, manager, heading, update, options)` from `declarativeCommandList.ts`; it works with any `CommandManagerBase`.
- Definitions are rebuilt on every render, so keep `getSettingDefinitions()` free of I/O. Call `this.update()` after changing the shape of a list.
- Preact is still used inside modals (`MacroBuilderModal`, `MobileModifyModal`, `confirmDeleteModal`) and the About row. It is not used for the settings tab itself.

To add a new settings page:
1. Create `src/ui/declarative<Feature>.ts` exporting a function that returns a `SettingDefinitionPage` (or list/group items)
2. Add it to `getSettingDefinitions()` / `commandPages()` in `settingTab.ts`
3. Wrap every user-visible string in `t()` and add the keys (see Localization)
4. If a control needs a non-settings key, add a prefix route in `getControlValue` / `setControlValue`

## Adding a new feature (checklist)

1. **Types**: Add fields to `CommanderSettings` in `src/types.ts`
2. **Defaults**: Add corresponding defaults in `DEFAULT_SETTINGS` in `src/constants.ts`
3. **Manager**: Create `src/manager/commands/<feature>Manager.ts` extending `CommandManagerBase`; export from `index.ts`
4. **main.ts**: Add nullish guard for any new array fields; instantiate manager; add to `plugin.manager`
5. **Settings UI**: Add a declarative page/definitions (see Settings UI); wire it into `settingTab.ts`
6. **Locale**: Add any new UI strings to `locale/en.json` and every non-empty locale (see Localization)
7. **Styles**: Add CSS classes to `src/styles/styles.scss` using `cmdr-` prefix

## Text Toolbar feature

The Text Toolbar (`src/manager/commands/textToolbarManager.ts`) shows a floating action bar above selected text in a markdown source editor. Key implementation notes:

- Enabled/disabled via `plugin.settings.textToolbarEnabled`
- Always instantiated; event handlers check the setting at runtime
- Toolbar element is appended to `document.body` with `position: fixed`
- Uses `mousedown` + `e.preventDefault()` on buttons to keep editor focus and preserve selection
- Checks that selection is inside `.cm-editor` before showing (prevents showing in UI panels)
- Desktop-only: mobile guard via `Platform.isMobile` in the manager
- Default commands (Bold, Italic, Strikethrough, Copy, Cut) can be individually hidden via `settings.hide.textToolbar`
- User-added commands are `CommandIconPair[]` stored in `settings.textToolbar`

## Manifest rules (`manifest.json`)

- `id`, `name`, `version` (SemVer), `minAppVersion`, `description`, `isDesktopOnly` are required
- Never change `id` after release
- Keep `minAppVersion` accurate when using newer APIs. It is `1.13.0` because the settings tab is declarative (`getSettingDefinitions()` has no `display()` fallback); `eslint-plugin-obsidianmd` warns if it drops below that.
- `versions.json` is updated by the `npm version` script at release time, not by hand; older Obsidian versions keep getting the last compatible release.
- The `obsidian` dev dependency must be >= 1.13.1 so the declarative settings types are available.

## Testing

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` (if any) to:
    ```
    <Vault>/.obsidian/plugins/<plugin-id>/
    ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**
- This plugin's source folder IS the installed plugin folder (Dev Vault), so building in place is sufficient — just reload Obsidian after `npm run build:esbuild`

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**:
- Default to local/offline operation. Only make network requests when essential.
- No hidden telemetry.
- Never execute remote code or auto-update plugin code outside of normal releases.
- Register and clean up all DOM, app, and interval listeners using `register*` helpers.

## Performance

- Keep startup light. Defer heavy work until `onLayoutReady`.
- Debounce expensive operations (e.g. selection-change handlers).
- Batch disk access; avoid excessive vault scans.

## Coding conventions

- TypeScript; existing codebase uses `"strict": false` but prefer strict-compatible code.
- CSS class prefix: `cmdr-` for all plugin-owned classes.
- Keep `main.ts` minimal — delegate all feature logic to managers and UI components.
- `this.register*` helpers for everything that needs cleanup.
- Prefer `async/await`; handle errors gracefully.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
