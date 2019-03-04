import { Disposable } from "atom";

interface ConfigSchema {
	team: string;
	avatars: boolean;
	showMarkers: boolean;
}

const KEYS_FOR_WEBVIEW = ["avatars", "showMarkers"];

// TODO: get this from codestream-components
interface WebviewConfigs {
	showHeadshots: boolean;
	debug: boolean;
	showMarkers: boolean;
	serverUrl: string;
	email?: string;
}

const keyForWebview = (key: string) => (key === "avatars" ? "showHeadshots" : key);

export class ConfigManager implements Disposable {
	get<T extends keyof ConfigSchema>(name: T): ConfigSchema[T] {
		return atom.config.get(`codestream.${name}`);
	}

	getForWebview(serverUrl: string, email?: string): WebviewConfigs {
		return {
			showHeadshots: this.get("avatars"),
			debug: atom.inDevMode(),
			showMarkers: this.get("showMarkers"),
			serverUrl,
			email,
		};
	}

	onDidChangeWebviewConfig(cb: (changes: Partial<WebviewConfigs>) => void) {
		return atom.config.onDidChange("codestream", ({ newValue, oldValue }) => {
			const diff: { [k in keyof WebviewConfigs]?: WebviewConfigs[k] } = {};

			Object.entries(newValue).forEach(([key, value]) => {
				if (KEYS_FOR_WEBVIEW.includes(key) && value !== oldValue[key])
					diff[keyForWebview(key)] = value;
			});

			if (Object.keys(diff).length > 0) cb(diff);
		});
	}

	dispose() {}
}
