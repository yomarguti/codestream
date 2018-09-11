import { AccessToken } from "../agent/agentConnection";
import { GlobalState } from "../common";
import { extensionId } from "../constants";
import { Container } from "../container";
import { keychain } from "../keychain";

const CredentialService = `${extensionId}:vscode`;

interface TokenMap {
	[key: string]: AccessToken | undefined;
}

export namespace TokenManager {
	function toKey(url: string, email: string) {
		return `${url}|${email}`.toLowerCase();
	}

	function getTokenMap() {
		return (
			Container.context.globalState.get<TokenMap>(GlobalState.AccessTokens) ||
			(Object.create(null) as TokenMap)
		);
	}

	export async function addOrUpdate(url: string, email: string, tokenValue: string) {
		if (!url || !email) return;

		const key = toKey(url, email);
		const token = { url: url, email: email, value: tokenValue };

		if (keychain !== undefined) {
			try {
				await keychain.setPassword(CredentialService, key, JSON.stringify(token));
				return;
			} catch (ex) {}
		}

		const tokens = getTokenMap();
		tokens[key] = token;
		await Container.context.globalState.update(GlobalState.AccessTokens, tokens);
	}

	export async function clear(url: string, email: string) {
		if (!url || !email) return;

		const key = toKey(url, email);

		if (keychain !== undefined) {
			try {
				await keychain.deletePassword(CredentialService, key);
				return;
			} catch (ex) {}
		}

		const tokens = getTokenMap();
		if (tokens[key] === undefined) return;

		delete tokens[key];
		await Container.context.globalState.update(GlobalState.AccessTokens, tokens);
	}

	// export async function clearAll() {
	// 	await Container.context.globalState.update(GlobalState.AccessTokens, undefined);
	// }

	export async function get(url: string, email: string): Promise<AccessToken | undefined> {
		if (!url || !email) return undefined;

		const key = toKey(url, email);

		let migrate = false;
		if (keychain !== undefined) {
			migrate = true;
			try {
				const tokenJson = await keychain.getPassword(CredentialService, key);
				if (tokenJson != null) {
					return JSON.parse(tokenJson) as AccessToken;
				}
			} catch (ex) {
				migrate = false;
			}
		}

		const tokens = getTokenMap();
		const token = tokens[key];

		if (migrate && token !== undefined) {
			await migrateTokenToKeyChain(key, token, tokens);
		}
		return token;
	}

	async function migrateTokenToKeyChain(
		key: string,
		token: AccessToken | undefined,
		tokens: TokenMap
	) {
		if (keychain === undefined || token === undefined) return;

		try {
			await keychain.setPassword(CredentialService, key, JSON.stringify(token));
		} catch (ex) {
			return;
		}

		delete tokens[key];
		await Container.context.globalState.update(GlobalState.AccessTokens, tokens);
	}
}
