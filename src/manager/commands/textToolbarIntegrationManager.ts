import CommanderPlugin from "src/main";
import { CommandIconPair } from "src/types";
import CommandManagerBase from "./commandManager";

interface TextToolbarAPI {
	setCommands(cmds: { id: string; icon: string; name: string }[]): void;
}

function getTextToolbarAPI(plugin: CommanderPlugin): TextToolbarAPI | undefined {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (plugin.app as any).plugins?.plugins?.["text-formatting-toolbar"]?.api;
}

export default class TextToolbarIntegrationManager extends CommandManagerBase {
	public constructor(plugin: CommanderPlugin, pairs: CommandIconPair[]) {
		super(plugin, pairs);
	}

	private sync(): void {
		const api = getTextToolbarAPI(this.plugin);
		if (!api) return;
		api.setCommands(this.pairs.map(p => ({ id: p.id, icon: p.icon, name: p.name })));
	}

	public static isAvailable(plugin: CommanderPlugin): boolean {
		return getTextToolbarAPI(plugin) !== undefined;
	}

	public async addCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.push(pair);
		await this.plugin.saveSettings();
		this.sync();
	}

	public async removeCommand(pair: CommandIconPair): Promise<void> {
		this.pairs.remove(pair);
		await this.plugin.saveSettings();
		this.sync();
	}

	public reorder(): void {
		this.sync();
	}
}
