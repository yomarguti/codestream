import { AccessToken } from "../agent/agentConnection";
import { GlobalState } from "../common";
import { Container } from "../container";

export namespace TokenManager {
	function toKey(url: string, email: string) {
		return `${url}|${email}`.toLowerCase();
	}

	function getTokenMap() {
		return (
			Container.context.globalState.get<{
				[key: string]: AccessToken;
			}>(GlobalState.AccessTokens) ||
			(Object.create(null) as {
				[key: string]: AccessToken;
			})
		);
	}

	export async function addOrUpdate(url: string, email: string, tokenValue: string) {
		if (!url || !email) return;

		const tokens = getTokenMap();
		tokens[toKey(url, email)] = { url: url, email: email, value: tokenValue };
		await Container.context.globalState.update(GlobalState.AccessTokens, tokens);
	}

	export async function clear(url: string, email: string) {
		if (!url || !email) return;

		const tokens = getTokenMap();
		delete tokens[toKey(url, email)];
		await Container.context.globalState.update(GlobalState.AccessTokens, tokens);
	}

	export async function clearAll() {
		await Container.context.globalState.update(GlobalState.AccessTokens, undefined);
	}

	export function get(url: string, email: string): AccessToken | undefined {
		if (!url || !email) return undefined;

		const tokens = getTokenMap();
		return tokens[toKey(url, email)];
	}
}
