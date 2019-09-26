"use strict";
import fetch, { RequestInit, Response } from "node-fetch";
import { URI } from "vscode-uri";
import { MessageType } from "../api/apiProvider";
import { User } from "../api/extensions";
import { SessionContainer } from "../container";
import { GitRemote } from "../git/gitService";
import { Logger } from "../logger";
import {
	AddEnterpriseProviderRequest,
	AddEnterpriseProviderResponse,
	CreateThirdPartyCardRequest,
	CreateThirdPartyCardResponse,
	DocumentMarker,
	FetchAssignableUsersRequest,
	FetchAssignableUsersResponse,
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	ThirdPartyProviderConfig
} from "../protocol/agent.protocol";
import { CSMe, CSProviderInfos } from "../protocol/api.protocol";
import { CodeStreamSession } from "../session";
import { Functions, Strings } from "../system";

export const providerNamesById = new Map<string, string>([
	["asana", "Asana"],
	["bitbucket", "Bitbucket"],
	["github", "GitHub"],
	["github_enterprise", "GitHub Enterprise"],
	["gitlab", "GitLab"],
	["jira", "Jira"],
	["jiraserver", "Jira Server"],
	["trello", "Trello"],
	["youtrack", "YouTrack"],
	["azuredevops", "Azure DevOps"],
	["slack", "Slack"],
	["msteams", "Microsoft Teams"]
]);

export interface ThirdPartyProviderSupportsIssues {
	getBoards(request: FetchThirdPartyBoardsRequest): Promise<FetchThirdPartyBoardsResponse>;
	getAssignableUsers(request: FetchAssignableUsersRequest): Promise<FetchAssignableUsersResponse>;
	createCard(request: CreateThirdPartyCardRequest): Promise<CreateThirdPartyCardResponse>;
}

export interface ThirdPartyProviderSupportsPullRequests {
	getPullRequestDocumentMarkers(request: {
		uri: URI;
		revision: string | undefined;
		repoId: string | undefined;
		streamId: string | undefined;
	}): Promise<DocumentMarker[]>;
}

export namespace ThirdPartyProvider {
	export function supportsIssues(
		provider: ThirdPartyProvider
	): provider is ThirdPartyProvider & ThirdPartyProviderSupportsIssues {
		return (
			(provider as any).getBoards !== undefined &&
			(provider as any).getAssignableUsers !== undefined &&
			(provider as any).createCard !== undefined
		);
	}
	export function supportsPullRequests(
		provider: ThirdPartyProvider
	): provider is ThirdPartyProvider & ThirdPartyProviderSupportsPullRequests {
		return (provider as any).getPullRequestDocumentMarkers !== undefined;
	}
}

export interface ThirdPartyProvider {
	readonly name: string;
	supportsIssues(): this is ThirdPartyProvider & ThirdPartyProviderSupportsIssues;
	supportsPullRequests(): this is ThirdPartyProvider & ThirdPartyProviderSupportsPullRequests;
	connect(): Promise<void>;
	configure(data: { [key: string]: any }): Promise<void>;
	disconnect(): Promise<void>;
	addEnterpriseHost(request: AddEnterpriseProviderRequest): Promise<AddEnterpriseProviderResponse>;
	getConfig(): ThirdPartyProviderConfig;
	isConnected(me: CSMe): boolean;
}

export interface ApiResponse<T> {
	body: T;
	response: Response;
}

interface RefreshableProviderInfo {
	expiresAt: number;
	refreshToken: string;
}

function isRefreshable<TProviderInfo extends CSProviderInfos>(
	providerInfo: TProviderInfo
): providerInfo is TProviderInfo & RefreshableProviderInfo {
	return typeof (providerInfo as any).expiresAt === "number";
}

export abstract class ThirdPartyProviderBase<
	TProviderInfo extends CSProviderInfos = CSProviderInfos
> implements ThirdPartyProvider {
	private _readyPromise: Promise<void> | undefined;
	protected _ensuringConnection: Promise<void> | undefined;
	protected _providerInfo: TProviderInfo | undefined;

	constructor(
		public readonly session: CodeStreamSession,
		protected readonly providerConfig: ThirdPartyProviderConfig
	) {}

	abstract get displayName(): string;
	abstract get name(): string;
	abstract get headers(): { [key: string]: string };

	get accessToken() {
		return this._providerInfo && this._providerInfo.accessToken;
	}

	get apiPath() {
		return "";
	}

	get baseUrl() {
		const { host, apiHost, isEnterprise } = this.providerConfig;
		const returnHost = isEnterprise ? host : `https://${apiHost}`;
		return `${returnHost}${this.apiPath}`;
	}

	supportsIssues(): this is ThirdPartyProvider & ThirdPartyProviderSupportsIssues {
		return ThirdPartyProvider.supportsIssues(this);
	}
	supportsPullRequests(): this is ThirdPartyProvider & ThirdPartyProviderSupportsPullRequests {
		return ThirdPartyProvider.supportsPullRequests(this);
	}

	async addEnterpriseHost(
		request: AddEnterpriseProviderRequest
	): Promise<AddEnterpriseProviderResponse> {
		return await this.session.api.addEnterpriseProviderHost({
			provider: this.providerConfig.name,
			teamId: this.session.teamId,
			host: request.host,
			data: request.data
		});
	}

	getConfig() {
		return this.providerConfig;
	}

	isConnected(user: CSMe): boolean {
		const providerInfo = this.getProviderInfo(user);
		return Boolean(providerInfo && providerInfo.accessToken);
	}

	async connect() {
		void (await this.session.api.connectThirdPartyProvider({
			providerId: this.providerConfig.id
		}));

		// FIXME - this rather sucks as a way to ensure we have the access token
		this._providerInfo = await new Promise<TProviderInfo>(resolve => {
			this.session.api.onDidReceiveMessage(e => {
				if (e.type !== MessageType.Users) return;

				const me = e.data.find(u => u.id === this.session.userId) as CSMe | null | undefined;
				if (me == null) return;

				const providerInfo = this.getProviderInfo(me);
				if (providerInfo == null || !providerInfo.accessToken) return;
				resolve(providerInfo);
			});
		});

		this._readyPromise = this.onConnected();
		await this._readyPromise;
	}

	protected async onConnected() {}

	async configure(data: { [key: string]: any }) {}

	protected async onConfigured() {}

	async disconnect() {
		void (await this.session.api.disconnectThirdPartyProvider({
			providerId: this.providerConfig.id
		}));
		this._readyPromise = this._providerInfo = undefined;
		await this.onDisconnected();
	}

	protected async onDisconnected() {}

	async ensureConnected() {
		if (this._readyPromise !== undefined) return this._readyPromise;

		if (this._providerInfo !== undefined) {
			await this.refreshToken();

			return;
		}

		if (this._ensuringConnection === undefined) {
			this._ensuringConnection = this.ensureConnectedCore();
		}
		void (await this._ensuringConnection);
	}

	private async refreshToken() {
		if (this._providerInfo === undefined || !isRefreshable(this._providerInfo)) {
			return;
		}

		const oneMinuteBeforeExpiration = this._providerInfo.expiresAt - 1000 * 60;
		if (oneMinuteBeforeExpiration > new Date().getTime()) return;

		try {
			const me = await this.session.api.refreshThirdPartyProvider({
				providerId: this.providerConfig.id,
				refreshToken: this._providerInfo.refreshToken
			});
			this._providerInfo = this.getProviderInfo(me);
		} catch (error) {
			await this.disconnect();
			return this.ensureConnected();
		}
	}

	private async ensureConnectedCore() {
		const { user } = await SessionContainer.instance().users.getMe();
		this._providerInfo = this.getProviderInfo(user);

		if (this._providerInfo === undefined) {
			throw new Error(`You must authenticate with ${this.displayName} first.`);
		}

		await this.refreshToken();
		await this.onConnected();

		this._ensuringConnection = undefined;
	}

	protected async delete<R extends object>(
		url: string,
		headers: { [key: string]: string } = {},
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
		let resp = undefined;
		if (resp === undefined) {
			await this.ensureConnected();
			resp = this.fetch<R>(
				url,
				{
					method: "DELETE",
					headers: { ...this.headers, ...headers }
				},
				options
			);
		}
		return resp;
	}

	protected async get<R extends object>(
		url: string,
		headers: { [key: string]: string } = {},
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
		await this.ensureConnected();
		return this.fetch<R>(
			url,
			{
				method: "GET",
				headers: { ...this.headers, ...headers }
			},
			options
		);
	}

	protected async post<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		headers: { [key: string]: string } = {},
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
		await this.ensureConnected();
		return this.fetch<R>(
			url,
			{
				method: "POST",
				body: JSON.stringify(body),
				headers: { ...this.headers, ...headers }
			},
			options
		);
	}

	protected async put<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		headers: { [key: string]: string } = {},
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
		await this.ensureConnected();
		return this.fetch<R>(
			url,
			{
				method: "PUT",
				body: JSON.stringify(body),
				headers: { ...this.headers, ...headers }
			},
			options
		);
	}

	protected getProviderInfo(me: CSMe) {
		return User.getProviderInfo<TProviderInfo>(
			me,
			this.session.teamId,
			this.name,
			this.providerConfig.isEnterprise ? this.providerConfig.host : undefined
		);
	}

	private async fetch<R extends object>(
		url: string,
		init: RequestInit,
		options: { [key: string]: any } = {}
	): Promise<ApiResponse<R>> {
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
			const absoluteUrl = options.absoluteUrl ? url : `${this.baseUrl}${url}`;

			let json: Promise<R> | undefined;
			let resp: Response | undefined;
			let retryCount = 0;
			if (json === undefined) {
				[resp, retryCount] = await this.fetchCore(0, absoluteUrl, init);

				if (resp.ok) {
					traceResult = `${this.displayName}: Completed ${method} ${url}`;
					json = resp.json() as Promise<R>;
				}
			}

			if (resp !== undefined && !resp.ok) {
				traceResult = `${this.displayName}: FAILED(${retryCount}x) ${method} ${url}`;
				throw await this.handleErrorResponse(resp);
			}

			return {
				body: await json!,
				response: resp!
			};
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
			if (resp.status < 200 || resp.status > 299) {
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
				if (Array.isArray(data.errors)) {
					for (const error of data.errors) {
						if (error.message) {
							message += `\n${error.message}`;
						}
					}
				}
				if (data.error) {
					if (data.error.message) {
						message += `: ${data.error.message}`;
					} else {
						message += `: ${data.error}`;
					}
				}
			} catch {}
		}
		return new Error(message);
	}
}

export interface PullRequestComment {
	author: {
		id: string;
		nickname: string;
	};
	createdAt: number;
	id: string;
	path: string;
	pullRequest: {
		id: number;
		url: string;
	};
	text: string;
	code: string;
	url: string;

	commit: string;
	originalCommit?: string;
	line: number;
	originalLine?: number;
	diffHunk?: string;
	outdated?: boolean;
}

export async function getOpenedRepos<R>(
	predicate: (remote: GitRemote) => boolean,
	queryFn: (path: string) => Promise<ApiResponse<R>>,
	remoteRepos: Map<string, R>
): Promise<Map<string, R>> {
	const openRepos = new Map<string, R>();

	const { git } = SessionContainer.instance();
	const gitRepos = await git.getRepositories();

	for (const gitRepo of gitRepos) {
		const remotes = await git.getRepoRemotes(gitRepo.path);
		for (const remote of remotes) {
			if (!openRepos.has(remote.path) && predicate(remote)) {
				let remoteRepo = remoteRepos.get(remote.path);
				if (remoteRepo == null) {
					try {
						const response = await queryFn(remote.path);
						remoteRepo = {
							...response.body,
							path: gitRepo.path
						};
						remoteRepos.set(remote.path, remoteRepo);
					} catch (ex) {
						Logger.error(ex);
						debugger;
					}
				}

				if (remoteRepo != null) {
					openRepos.set(remote.path, remoteRepo);
				}
			}
		}
	}

	return openRepos;
}

export async function getRepoRemotePaths<R extends { path: string }>(
	filePath: string,
	predicate: (remote: GitRemote) => boolean,
	remoteRepos: Map<string, R>
): Promise<{ remotePath: string | undefined; repoPath: string | undefined }> {
	try {
		const repo = await SessionContainer.instance().git.getRepositoryByFilePath(filePath);
		if (repo === undefined) return { remotePath: undefined, repoPath: undefined };

		const remotes = await repo.getRemotes();

		let remotePath;
		for (const [path, remoteRepo] of remoteRepos.entries()) {
			if (remoteRepo.path === repo.path) {
				remotePath = path;
			}
		}

		if (remotePath) return { remotePath: remotePath, repoPath: repo.path };

		const remote = remotes.find(predicate);
		return { remotePath: remote && remote.path, repoPath: repo.path };
	} catch (ex) {
		return { remotePath: undefined, repoPath: undefined };
	}
}
