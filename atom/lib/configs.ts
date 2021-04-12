import { TraceLevel } from "@codestream/protocols/agent";
import { WebviewConfigs } from "@codestream/protocols/webview";
import { Disposable } from "atom";
import { PackageState } from "types/package";

export interface ConfigSchema {
	serverUrl: string;
	team: string;
	avatars: boolean;
	showMarkers: boolean;
	autoHideMarkers: boolean;
	autoSignIn: boolean;
	traceLevel: TraceLevel;
	proxySupport: "off" | "on";
	proxyUrl: string;
	proxyStrictSSL: boolean;
	disableStrictSSL: boolean;
}

const KEYS_FOR_WEBVIEW = ["avatars", "showMarkers"];

const keyForWebview = (key: string) => (key === "avatars" ? "showHeadshots" : key);

export class ConfigManager implements Disposable {
	readonly inMemory = {
		debug: false
	};

	constructor(state: PackageState) {
		this.inMemory.debug = state.debug !== undefined ? state.debug : false;
	}

	get<K extends keyof ConfigSchema>(name: K): ConfigSchema[K] {
		return atom.config.get(`codestream.${name}`);
	}

	getForWebview(email?: string): WebviewConfigs {
		return {
			showHeadshots: this.get("avatars"),
			debug: atom.inDevMode(),
			team: this.get("team"),
			serverUrl: this.get("serverUrl"),
			email,
			environment: "unknown", 
			isOnPrem: false, 
			isProductionCloud: false
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
