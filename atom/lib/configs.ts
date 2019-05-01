import { WebviewConfigs } from "@codestream/protocols/webview";
import { Disposable, Emitter } from "atom";

export interface ConfigSchema {
	team: string;
	avatars: boolean;
	showMarkers: boolean;
	autoHideMarkers: boolean;
	autoSignIn: boolean;
}

const KEYS_FOR_WEBVIEW = ["avatars", "showMarkers"];

const keyForWebview = (key: string) => (key === "avatars" ? "showHeadshots" : key);

export class ConfigManager implements Disposable {
	private emitter: Emitter;

	constructor() {
		this.emitter = new Emitter();
	}

	get<K extends keyof ConfigSchema>(name: K): ConfigSchema[K] {
		return atom.config.get(`codestream.${name}`);
	}

	getForWebview(serverUrl: string, email?: string): WebviewConfigs {
		return {
			showHeadshots: this.get("avatars"),
			debug: atom.inDevMode(),
			serverUrl,
			email,
		};
	}

	onDidChangeWebviewConfig(cb: (changes: Partial<WebviewConfigs>) => void) {
		return atom.config.onDidChange("codestream", ({ newValue, oldValue }) => {
			const diff: { [k in keyof WebviewConfigs]?: WebviewConfigs[k] } = {};

			Object.entries(newValue).forEach(([key, value]) => {
				if (KEYS_FOR_WEBVIEW.includes(key) && value !== oldValue[key]) {
					diff[keyForWebview(key)] = value;
				}
			});

			if (Object.keys(diff).length > 0) cb(diff);
		});
	}

	onDidChange<K extends keyof ConfigSchema>(
		key: K,
		cb: (value: { oldValue: ConfigSchema[K]; newValue: ConfigSchema[K] }) => void
	) {
		return atom.config.onDidChange(`codestream.${key}` as any, cb as any);
	}

	isUserSetting(key: string) {
		const schema = atom.config.getSchema(`codestream.${key}`);
		if (schema === null || (schema as any).type === "any") return false;
		return true;
	}

	set<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]) {
		atom.config.set(`codestream.${key}` as any, value);
	}

	dispose() {}
}
