"use strict";
import fetch, { Headers, RequestInit, Response } from "node-fetch";
import { URLSearchParams } from "url";
import { ServerError } from "../agentError";
import { Logger } from "../logger";
import {
	AccessToken,
	CreateChannelStreamRequest,
	CreateDirectStreamRequest,
	CreatePostRequest,
	CreateRepoRequest,
	DeletePostRequest,
	EditPostRequest,
	FetchLatestPostRequest,
	FetchPostRepliesRequest,
	FetchPostsByRangeRequest,
	FetchPostsRequest,
	GetPostRequest,
	InviteUserRequest,
	MarkPostUnreadRequest,
	ReactToPostRequest,
	UpdatePreferencesRequest,
	UpdatePresenceRequest
} from "../shared/agent.protocol";
import {
	CompleteSignupRequest,
	CSChannelStream,
	CSCreateChannelStreamRequest,
	CSCreateChannelStreamResponse,
	CSCreateDirectStreamRequest,
	CSCreateDirectStreamResponse,
	CSCreatePostRequest,
	CSCreatePostResponse,
	CSCreateRepoRequest,
	CSCreateRepoResponse,
	CSDeletePostResponse,
	CSDirectStream,
	CSEditPostRequest,
	CSEditPostResponse,
	CSFileStream,
	CSGetMeResponse,
	CSGetPostResponse,
	CSGetPostsResponse,
	CSGetReposResponse,
	CSInviteUserRequest,
	CSInviteUserResponse,
	CSMarker,
	CSMarkerLocations,
	CSMarkPostUnreadRequest,
	CSMarkPostUnreadResponse,
	CSMePreferences,
	CSPresenceStatus,
	CSReactions,
	CSReactToPostResponse,
	CSRepository,
	CSStream,
	CSTeam,
	CSUpdatePresenceRequest,
	CSUpdatePresenceResponse,
	CSUser,
	LoginRequest,
	LoginResponse,
	StreamType
} from "../shared/api.protocol";
import { Functions, Strings } from "../system";
import {
	ApiProvider,
	CodeStreamApiMiddleware,
	CodeStreamApiMiddlewareContext,
	LoginOptions,
	VersionInfo
} from "./apiProvider";
import { Cache } from "./cache";

export class CodeStreamApiProvider implements ApiProvider {
	private readonly _middleware: CodeStreamApiMiddleware[] = [];
	private _token: string | undefined;
	private _teamId: string | undefined;
	private _userId: string | undefined;

	private readonly _cache: Cache;

	constructor(public readonly baseUrl: string, private readonly _version: VersionInfo) {
		this._cache = new Cache(this);
	}

	get teamId(): string {
		return this._teamId!;
	}

	get userId(): string {
		return this._userId!;
	}

	useMiddleware(middleware: CodeStreamApiMiddleware) {
		this._middleware.push(middleware);
		return {
			dispose: () => {
				const i = this._middleware.indexOf(middleware);
				this._middleware.splice(i, 1);
			}
		};
	}

	async login(options: LoginOptions): Promise<LoginResponse & { teamId: string }> {
		let response;
		switch (options.type) {
			case "credentials":
				response = await this.put<LoginRequest, LoginResponse>("/no-auth/login", {
					email: options.email,
					password: options.password
				});
				break;

			case "otc":
				response = await this.put<CompleteSignupRequest, LoginResponse>("/no-auth/check-signup", {
					token: options.code
				});
				break;

			case "token":
				response = await this.put<{}, LoginResponse>("/login", {}, options.token.value);
				break;

			default:
				throw new Error("Invalid login options");
		}

		// If there is only 1 team, use it regardless of config
		if (response.teams.length === 1) {
			options.teamId = response.teams[0].id;
		} else {
			// Sort the teams from oldest to newest
			response.teams.sort((a, b) => a.createdAt - b.createdAt);
		}

		if (options.teamId == null) {
			if (options.team) {
				const normalizedTeamName = options.team.toLocaleUpperCase();
				const team = response.teams.find(t => t.name.toLocaleUpperCase() === normalizedTeamName);
				if (team != null) {
					options.teamId = team.id;
				}
			}

			// If we still can't find a team, then just pick the first one
			if (options.teamId == null) {
				options.teamId = response.teams[0].id;
			}
		}

		if (response.teams.find(t => t.id === options.teamId) === undefined) {
			options.teamId = response.teams[0].id;
		}

		this._teamId = options.teamId;
		this._token = response.accessToken;
		this._userId = response.user.id;

		return { ...response, teamId: options.teamId };
	}

	getMe() {
		return this.get<CSGetMeResponse>("/users/me", this._token);
	}

	inviteUser(request: InviteUserRequest) {
		return this.post<CSInviteUserRequest, CSInviteUserResponse>(
			"/users",
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	async updatePreferences(request: UpdatePreferencesRequest) {
		void (await this.put<CSMePreferences, any>("/preferences", request.preferences, this._token));
		return this.getMe();
	}

	updatePresence(request: UpdatePresenceRequest) {
		return this.put<CSUpdatePresenceRequest, CSUpdatePresenceResponse>(
			`/presence`,
			request,
			this._token
		);
	}

	createPost(request: CreatePostRequest) {
		return this.post<CSCreatePostRequest, CSCreatePostResponse>(
			`/posts`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	async deletePost(request: DeletePostRequest) {
		const response = await this.delete<CSDeletePostResponse>(`/posts/${request.id}`, this._token);

		const post = await this._cache.resolvePost(response.post);
		return { ...response, post: post };
	}

	async editPost(request: EditPostRequest) {
		const response = await this.put<CSEditPostRequest, CSEditPostResponse>(
			`/posts/${request.id}`,
			request,
			this._token
		);

		const post = await this._cache.resolvePost(response.post);
		return { ...response, post: post };
	}

	async fetchLatestPost(request: FetchLatestPostRequest) {
		const response = await this.get<CSGetPostsResponse>(
			`/posts/?teamId=${this.teamId}&streamId=${request.streamId}&limit=1`,
			this._token
		);

		const { posts, ...rest } = response;
		return { ...rest, post: posts[0] };
	}

	fetchPostReplies(request: FetchPostRepliesRequest) {
		return this.get<CSGetPostsResponse>(
			`/posts?teamId=${this.teamId}?parentPostId=${request.id}`,
			this._token
		);
	}

	async fetchPosts(request: FetchPostsRequest) {
		// if (request.limit !== undefined) {
		// 	return (await Container.agent.getPosts(streamId, limit, beforeSeq)).posts;
		// }

		return this.get<CSGetPostsResponse>(
			`/posts?teamId=${this.teamId}&streamId=${request.streamId}`,
			this._token
		);
	}

	// fetchPostsBySequence(
	// 	streamId: string,
	// 	minSeq: number,
	// 	maxSeq: number
	// ): Promise<CSGetPostsResponse> {
	// 	return this.get<CSGetPostsResponse>(
	// 		`/posts?teamId=${this._teamId}&streamId=${streamId}&seqnum=${minSeq}-${maxSeq}`,
	// 		this._token
	// 	);
	// }

	// fetchPostsLesserThan(
	// 	token: string,
	// 	teamId: string,
	// 	streamId: string,
	// 	limit: number,
	// 	lt?: string
	// ): Promise<CSGetPostsResponse> {
	// 	const teamParam = `?teamId=${teamId}`;
	// 	const streamParam = `&streamId=${streamId}`;
	// 	const ltParam = lt ? `&lt=${lt}` : "";
	// 	const limitParam = `&limit=${limit}`;
	// 	return this.get<CSGetPostsResponse>(
	// 		`/posts${teamParam}${streamParam}${ltParam}${limitParam}`,
	// 		token
	// 	);
	// }

	fetchPostsByRange(request: FetchPostsByRangeRequest) {
		return this.get<CSGetPostsResponse>(
			`/posts/?teamId=${this.teamId}&streamId=${request.streamId}&seqnum=${request.range}`,
			this._token
		);
	}

	getPost(request: GetPostRequest) {
		return this.get<CSGetPostResponse>(`/posts/${request.id}?teamId=${this.teamId}`, this._token);
	}

	async markPostUnread(request: MarkPostUnreadRequest) {
		const response = await this.put<CSMarkPostUnreadRequest, CSMarkPostUnreadResponse>(
			`/unread/${request.id}`,
			request,
			this._token
		);

		const post = await this._cache.resolvePost(response.post);
		return { ...response, post: post };
	}

	async reactToPost(request: ReactToPostRequest) {
		const response = await this.put<CSReactions, CSReactToPostResponse>(
			`/react/${request.id}`,
			request.emojis,
			this._token
		);

		const post = await this._cache.resolvePost(response.post);
		return { ...response, post: post };
	}

	// async getMarker(markerId: string, teamId?: string): Promise<CSMarker> {
	// 	return (await this._codestream.getMarker(this._token, teamId || this._teamId, markerId)).marker;
	// }

	// async getMarkers(commitHash: string, streamId: string, teamId?: string): Promise<CSMarker[]> {
	// 	return (await this._codestream.getMarkers(this._token, teamId || this._teamId, streamId))
	// 		.markers;
	// }

	// async getMarkerLocations(
	// 	commitHash: string,
	// 	streamId: string,
	// 	teamId?: string
	// ): Promise<CSMarkerLocations> {
	// 	return (await this._codestream.getMarkerLocations(
	// 		this._token,
	// 		teamId || this._teamId,
	// 		streamId,
	// 		commitHash
	// 	)).markerLocations;
	// }

	createRepo(request: CreateRepoRequest) {
		return this.post<CSCreateRepoRequest, CSCreateRepoResponse>(
			`/repos`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	fetchRepos() {
		return this.get<CSGetReposResponse>(`/repos?teamId=${this.teamId}`, this._token);
	}

	// async getRepo(repoId: string, teamId?: string): Promise<CSRepository | undefined> {
	// 	return (await this._codestream.getRepo(this._token, teamId || this._teamId, repoId)).repo;
	// }

	createChannelStream(request: CreateChannelStreamRequest) {
		return this.post<CSCreateChannelStreamRequest, CSCreateChannelStreamResponse>(
			`/streams`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	createDirectStream(request: CreateDirectStreamRequest) {
		return this.post<CSCreateDirectStreamRequest, CSCreateDirectStreamResponse>(
			`/streams`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	// async createFileStream(relativePath: string, repoId: string) {
	// 	return this.createStream<CSCreateFileStreamRequest, CSCreateFileStreamResponse>({
	// 		teamId: this._teamId,
	// 		type: StreamType.File,
	// 		repoId: repoId,
	// 		file: relativePath
	// 	});
	// }

	// async getStream(streamId: string, teamId?: string): Promise<CSStream | undefined> {
	// 	return (await this._codestream.getStream(this._token, teamId || this._teamId, streamId)).stream;
	// }

	// async getUnreadStreams(teamId?: string): Promise<CSStream[]> {
	// 	return (await this._codestream.getUnreadStreams(this._token, teamId || this._teamId)).streams;
	// }

	// async getChannelStreams(teamId?: string): Promise<CSChannelStream[]> {
	// 	return (await this._codestream.getStreams<CSChannelStream>(
	// 		this._token,
	// 		teamId || this._teamId
	// 	)).streams.filter(s => s.type === StreamType.Channel);
	// }

	// async getChannelOrDirectStreams(teamId?: string): Promise<(CSChannelStream | CSDirectStream)[]> {
	// 	return (await this._codestream.getStreams<CSChannelStream | CSDirectStream>(
	// 		this._token,
	// 		teamId || this._teamId
	// 	)).streams.filter(s => s.type === StreamType.Channel || s.type === StreamType.Direct);
	// }

	// async getDirectStreams(teamId?: string): Promise<CSDirectStream[]> {
	// 	return (await this._codestream.getStreams<CSDirectStream>(
	// 		this._token,
	// 		teamId || this._teamId
	// 	)).streams.filter(s => s.type === StreamType.Direct);
	// }

	// async getFileStreams(repoId: string, teamId?: string): Promise<CSFileStream[]> {
	// 	return (await this._codestream.getStreams<CSFileStream>(
	// 		this._token,
	// 		teamId || this._teamId,
	// 		repoId
	// 	)).streams;
	// }

	// async getTeam(teamId: string): Promise<CSTeam | undefined> {
	// 	return (await this._codestream.getTeam(this._token, teamId)).team;
	// }

	// async getTeams(ids: string[]): Promise<CSTeam[]> {
	// 	return (await this._codestream.getTeams(this._token, ids)).teams;
	// }

	// async getUser(userId: string, teamId?: string): Promise<CSUser | undefined> {
	// 	return (await this._codestream.getUser(this._token, teamId || this._teamId, userId)).user;
	// }

	// async getUsers(teamId?: string): Promise<CSUser[]> {
	// 	return (await this._codestream.getUsers(this._token, teamId || this._teamId)).users;
	// }

	// async joinStream(streamId: string, teamId?: string): Promise<CSStream> {
	// 	return this._cache.resolveStream(
	// 		await this._codestream.joinStream(this._token, teamId || this._teamId, streamId)
	// 	);
	// }

	// async leaveStream(streamId: string, teamId?: string): Promise<CSStream> {
	// 	return this._cache.resolveStream(
	// 		await this._codestream.updateStream(this._token, teamId || this._teamId, streamId, {
	// 			$pull: { memberIds: [this._userId] }
	// 		})
	// 	);
	// }

	// // async addUserToStream(streamId: string, userId: string, teamId?: string) {
	// // 	return (await this._api.updateStreamMembership(this.token, teamId || this.teamId, streamId, {
	// // 		$push: userId
	// // 	})).stream;
	// // }

	// async updateStream(
	// 	streamId: string,
	// 	changes: { [key: string]: any },
	// 	teamId?: string
	// ): Promise<CSStream> {
	// 	return this._cache.resolveStream(
	// 		await this._codestream.updateStream(this._token, teamId || this._teamId, streamId, changes)
	// 	);
	// }

	// async markStreamRead(streamId: string) {
	// 	return await this._codestream.markStreamRead(this._token, streamId);
	// }

	private delete<R extends object>(url: string, token?: string): Promise<R> {
		let resp = undefined;
		if (resp === undefined) {
			resp = this.fetch<R>(url, { method: "DELETE" }, token) as Promise<R>;
		}
		return resp;
	}

	private get<R extends object>(url: string, token?: string): Promise<R> {
		return this.fetch<R>(url, { method: "GET" }, token) as Promise<R>;
	}

	private post<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		token?: string
	): Promise<R> {
		return this.fetch<R>(
			url,
			{
				method: "POST",
				body: JSON.stringify(body)
			},
			token
		);
	}

	private put<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		token?: string
	): Promise<R> {
		return this.fetch<R>(
			url,
			{
				method: "PUT",
				body: JSON.stringify(body)
			},
			token
		);
	}

	/*private*/ async fetch<R extends object>(
		url: string,
		init?: RequestInit,
		token?: string
	): Promise<R> {
		const start = process.hrtime();

		let traceResult;
		try {
			if (init !== undefined || token !== undefined) {
				if (init === undefined) {
					init = {};
				}

				if (init.headers === undefined) {
					init.headers = new Headers();
				}

				if (init.headers instanceof Headers) {
					init.headers.append("Accept", "application/json");
					init.headers.append("Content-Type", "application/json");

					if (token !== undefined) {
						init.headers.append("Authorization", `Bearer ${token}`);
					}

					init.headers.append("X-CS-Plugin-IDE", "VS Code");
					init.headers.append(
						"X-CS-Plugin-Version",
						`${this._version.extensionVersion}-${this._version.extensionBuild}`
					);
					init.headers.append("X-CS-IDE-Version", this._version.ideVersion);
				}
			}

			const method = (init && init.method) || "GET";
			const absoluteUrl = `${this.baseUrl}${url}`;

			const context =
				this._middleware.length > 0
					? ({
							url: absoluteUrl,
							method: method,
							request: init
					  } as CodeStreamApiMiddlewareContext)
					: undefined;

			if (context !== undefined) {
				for (const mw of this._middleware) {
					if (mw.onRequest === undefined) continue;

					try {
						await mw.onRequest(context);
					} catch (ex) {
						Logger.error(ex, `API: ${method} ${url}: Middleware(${mw.name}).onRequest FAILED`);
					}
				}
			}

			let json: Promise<R> | undefined;
			if (context !== undefined) {
				for (const mw of this._middleware) {
					if (mw.onProvideResponse === undefined) continue;

					try {
						json = mw.onProvideResponse(context!);
						if (json !== undefined) break;
					} catch (ex) {
						Logger.error(
							ex,
							`API: ${method} ${url}: Middleware(${mw.name}).onProvideResponse FAILED`
						);
					}
				}
			}

			let resp;
			let retryCount = 0;
			if (json === undefined) {
				[resp, retryCount] = await this.fetchCore(0, absoluteUrl, init);
				if (context !== undefined) {
					context.response = resp;
				}

				if (resp.ok) {
					traceResult = `API: Completed ${method} ${url}`;
					json = resp.json() as Promise<R>;
				}
			}

			if (context !== undefined) {
				for (const mw of this._middleware) {
					if (mw.onResponse === undefined) continue;

					try {
						await mw.onResponse(context!, json);
					} catch (ex) {
						Logger.error(ex, `API: ${method} ${url}: Middleware(${mw.name}).onResponse FAILED`);
					}
				}
			}

			if (resp !== undefined && !resp.ok) {
				traceResult = `API: FAILED(${retryCount}x) ${method} ${url}`;
				throw await this.handleErrorResponse(resp);
			}

			return CodeStreamApiProvider.normalizeResponse(await json!);
		} finally {
			Logger.log(
				`${traceResult}${
					init && init.body ? ` body=${CodeStreamApiProvider.sanitize(init && init.body)}` : ""
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
			debugger;
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
		return new ServerError(message, data, response.status);
	}

	static isStreamSubscriptionRequired(stream: CSStream, userId: string): boolean {
		if (stream.deactivated || stream.type === StreamType.File) return false;
		if (stream.type === StreamType.Channel) {
			if (stream.memberIds === undefined) return false;
			if (!stream.memberIds.includes(userId)) return false;
		}
		return true;
	}

	static normalizeResponse<R extends object>(obj: { [key: string]: any }): R {
		// FIXME maybe the api server should never return arrays with null elements?
		if (obj != null) {
			for (const [key, value] of Object.entries(obj)) {
				if (key === "_id") {
					obj["id"] = value;
				}

				if (Array.isArray(value)) {
					obj[key] = value.map(v => this.normalizeResponse(v));
				} else if (typeof value === "object") {
					obj[key] = this.normalizeResponse(value);
				}
			}
		}

		return obj as R;
	}

	static sanitize(
		body:
			| string
			| ArrayBuffer
			| ArrayBufferView
			| NodeJS.ReadableStream
			| URLSearchParams
			| undefined
	) {
		if (body === undefined || typeof body !== "string") return "";

		return body
			.replace(/("password":)".*?"/gi, '$1"<hidden>"')
			.replace(/("token":)".*?"/gi, '$1"<hidden>"');
	}
}
