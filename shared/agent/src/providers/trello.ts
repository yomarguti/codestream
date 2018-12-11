"use strict";
import fetch, { RequestInit, Response } from "node-fetch";
import * as qs from "querystring";
import { Logger } from "../logger";
import { CodeStreamSession } from "../session";
import {
	TrelloAuthRequest,
	TrelloAuthRequestType,
	TrelloBoard,
	TrelloCreateCardRequest,
	TrelloCreateCardRequestType,
	TrelloCreateCardResponse,
	TrelloFetchBoardsRequest,
	TrelloFetchBoardsRequestType,
	TrelloFetchListsRequest,
	TrelloFetchListsRequestType,
	TrelloList
} from "../shared/agent.protocol";
import { Functions, log, lsp, lspHandler, Strings } from "../system";

@lsp
export class TrelloProvider {
	private readonly _baseUrl = "https://api.trello.com/1";
	private readonly _key: string;
	private _token: string | undefined;
	private _userId: string | undefined;

	constructor(session: CodeStreamSession) {
		this._key = "2ddb4a0ef22ece7fc17c09f82ad14a1b";
	}

	@log()
	@lspHandler(TrelloAuthRequestType)
	async auth(request: TrelloAuthRequest) {
		// TODO
		this._token = "<YOUR-TOKEN-HERE>";

		const tokenResponse = await this.get<{ idMember: string; [key: string]: any }>(
			`/token/${this._token}?${qs.stringify({ key: this._key, token: this._token })}`
		);

		this._userId = tokenResponse.idMember;

		// const memberResponse = await this.get<{
		// 	username: string;
		// 	idBoards: string[];
		// 	idOrganizations: string[];
		// 	[key: string]: any;
		// }>(`/members/${this._userId}?${qs.stringify({ key: this._key, token: this._token })}`);
	}

	@log()
	@lspHandler(TrelloFetchBoardsRequestType)
	async boards(request: TrelloFetchBoardsRequest) {
		const response = await this.get<TrelloBoard[]>(
			`/members/${this._userId}/boards?${qs.stringify({
				filter: "open",
				fields: "id,name,desc,descData,closed,idOrganization,pinned,url,labelNames,starred",
				// lists: "open",
				key: this._key,
				token: this._token
			})}`
		);

		return {
			boards: request.organizationId
				? response.filter(b => b.idOrganization === request.organizationId)
				: response
		};
	}

	@log()
	@lspHandler(TrelloCreateCardRequestType)
	async createCard(request: TrelloCreateCardRequest) {
		const response = await this.post<{}, TrelloCreateCardResponse>(
			`/cards?${qs.stringify({
				idList: request.listId,
				name: request.name,
				desc: request.description,
				key: this._key,
				token: this._token
			})}`,
			{}
		);
		return response;
	}

	@log()
	@lspHandler(TrelloFetchListsRequestType)
	async lists(request: TrelloFetchListsRequest) {
		const response = await this.get<TrelloList[]>(
			`/boards/${request.boardId}/lists?${qs.stringify({ key: this._key, token: this._token })}`
		);
		return { lists: response.filter(l => !l.closed) };
	}

	private delete<R extends object>(url: string): Promise<R> {
		let resp = undefined;
		if (resp === undefined) {
			resp = this.fetch<R>(url, { method: "DELETE" }) as Promise<R>;
		}
		return resp;
	}

	private get<R extends object>(url: string): Promise<R> {
		return this.fetch<R>(url, { method: "GET" }) as Promise<R>;
	}

	private post<RQ extends object, R extends object>(url: string, body: RQ): Promise<R> {
		return this.fetch<R>(url, {
			method: "POST",
			body: JSON.stringify(body)
		});
	}

	private put<RQ extends object, R extends object>(url: string, body: RQ): Promise<R> {
		return this.fetch<R>(url, {
			method: "PUT",
			body: JSON.stringify(body)
		});
	}
	private async fetch<R extends object>(url: string, init?: RequestInit): Promise<R> {
		const start = process.hrtime();

		let traceResult;
		try {
			if (init !== undefined) {
				if (init === undefined) {
					init = {};
				}
			}

			// if (this._proxyAgent !== undefined) {
			// 	if (init === undefined) {
			// 		init = {};
			// 	}

			// 	init.agent = this._proxyAgent;
			// }

			const method = (init && init.method) || "GET";
			const absoluteUrl = `${this._baseUrl}${url}`;

			let json: Promise<R> | undefined;
			let resp;
			let retryCount = 0;
			if (json === undefined) {
				[resp, retryCount] = await this.fetchCore(0, absoluteUrl, init);

				if (resp.ok) {
					traceResult = `TRELLO: Completed ${method} ${url}`;
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
