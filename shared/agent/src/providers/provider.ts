"use strict";
import fetch, { RequestInit, Response } from "node-fetch";
import { MessageType } from "../api/apiProvider";
import { User } from "../api/extensions";
import { Container } from "../container";
import { Logger } from "../logger";
import { CodeStreamSession } from "../session";
import {
	ConnectThirdParyProviderRequest,
	DisconnectThirdParyProviderRequest
} from "../shared/agent.protocol";
import { CSMe, CSProviderInfos } from "../shared/api.protocol";
import { Functions, Strings } from "../system";

export interface ThirdPartyProvider {
	readonly name: string;
	connect(request: ConnectThirdParyProviderRequest): Promise<void>;
	disconnect(request: DisconnectThirdParyProviderRequest): Promise<void>;
}

export abstract class ThirdPartyProviderBase<
	TProviderInfo extends CSProviderInfos = CSProviderInfos
> implements ThirdPartyProvider {
	private _readyPromise: Promise<void> | undefined;
	protected _ensuringConnection: Promise<void> | undefined;
	protected _providerInfo: TProviderInfo | undefined;

	constructor(public readonly session: CodeStreamSession) {}

	abstract get baseUrl(): string;
	abstract get displayName(): string;
	abstract get name(): string;

	async connect(request: ConnectThirdParyProviderRequest) {
		void (await this.session.api.connectThirdPartyProvider({
			providerName: this.name
		}));
		this._providerInfo = await new Promise<TProviderInfo>(resolve => {
			this.session.api.onDidReceiveMessage(e => {
				if (e.type !== MessageType.Users) return;

				const me = e.data.find(u => u.id === this.session.userId) as CSMe | null | undefined;
				if (me == null) return;

				const providerInfo = this.getProviderInfo(me);
				if (providerInfo == null) return;

				resolve(providerInfo);
			});
		});

		this._readyPromise = this.onConnected();
		await this._readyPromise;
	}

	protected async onConnected() {}

	async disconnect(request: DisconnectThirdParyProviderRequest) {
		void (await this.session.api.disconnectThirdPartyProvider({ providerName: this.name }));
		void (await this.onDisconnected());
	}

	protected async onDisconnected() {}

	async ensureConnected() {
		if (this._readyPromise) {
			return this._readyPromise;
		}
		if (this._providerInfo !== undefined) return;

		if (this._ensuringConnection === undefined) {
			this._ensuringConnection = this.ensureConnectedCore();
		}
		void (await this._ensuringConnection);
	}

	private async ensureConnectedCore() {
		const response = await Container.instance().users.getMe();
		this._providerInfo = this.getProviderInfo(response.user);

		if (this._providerInfo === undefined) {
			throw new Error(`You must authenticate with ${this.displayName} first.`);
		}

		await this.onConnected();

		this._ensuringConnection = undefined;
	}

	protected delete<R extends object>(url: string): Promise<R> {
		let resp = undefined;
		if (resp === undefined) {
			resp = this.fetch<R>(url, { method: "DELETE" }) as Promise<R>;
		}
		return resp;
	}

	protected get<R extends object>(url: string): Promise<R> {
		return this.fetch<R>(url, { method: "GET" }) as Promise<R>;
	}

	protected post<RQ extends object, R extends object>(url: string, body: RQ): Promise<R> {
		return this.fetch<R>(url, {
			method: "POST",
			body: JSON.stringify(body)
		});
	}

	protected put<RQ extends object, R extends object>(url: string, body: RQ): Promise<R> {
		return this.fetch<R>(url, {
			method: "PUT",
			body: JSON.stringify(body)
		});
	}

	private getProviderInfo(me: CSMe) {
		return User.getProviderInfo<TProviderInfo>(me, this.session.teamId, this.name);
	}

	protected async fetch<R extends object>(url: string, init?: RequestInit): Promise<R> {
		const start = process.hrtime();

		let traceResult;
		try {
			if (init !== undefined) {
				if (init === undefined) {
					init = {};
				}
			}

			// TODO: Get this to work with proxies
			// if (this._proxyAgent !== undefined) {
			// 	if (init === undefined) {
			// 		init = {};
			// 	}

			// 	init.agent = this._proxyAgent;
			// }

			const method = (init && init.method) || "GET";
			const absoluteUrl = `${this.baseUrl}${url}`;

			let json: Promise<R> | undefined;
			let resp;
			let retryCount = 0;
			if (json === undefined) {
				[resp, retryCount] = await this.fetchCore(0, absoluteUrl, init);

				if (resp.ok) {
					traceResult = `${this.displayName}: Completed ${method} ${url}`;
					json = resp.json() as Promise<R>;
				}
			}

			if (resp !== undefined && !resp.ok) {
				traceResult = `TRELLO: FAILED(${retryCount}x) ${method} ${url}`;
				throw await this.handleErrorResponse(resp);
			}

			return await json!;
		} finally {
			Logger.log(
				`${traceResult}${
					init && init.body ? ` body=${init && init.body}` : ""
				} \u2022 ${Strings.getDurationMilliseconds(start)} ms`
			);
		}
	}

	private async fetchCore(
		count: number,
		url: string,
		init?: RequestInit
	): Promise<[Response, number]> {
		try {
			const resp = await fetch(url, init);
			if (resp.status !== 200) {
				if (resp.status < 400 || resp.status >= 500) {
					count++;
					if (count <= 3) {
						await Functions.wait(250 * count);
						return this.fetchCore(count, url, init);
					}
				}
			}
			return [resp, count];
		} catch (ex) {
			Logger.error(ex);

			count++;
			if (count <= 3) {
				await Functions.wait(250 * count);
				return this.fetchCore(count, url, init);
			}

			throw ex;
		}
	}

	private async handleErrorResponse(response: Response): Promise<Error> {
		let message = response.statusText;
		let data;
		if (response.status >= 400 && response.status < 500) {
			try {
				data = await response.json();
				if (data.code) {
					message += `(${data.code})`;
				}
				if (data.message) {
					message += `: ${data.message}`;
				}
				if (data.info && data.info.name) {
					message += `\n${data.info.name}`;
				}
			} catch {}
		}
		return new Error(message);
	}
}
