"use strict";
import fetch, { Headers, RequestInit, Response } from "node-fetch";
import { URLSearchParams } from "url";
import { ServerError } from "../agentError";
import { Container } from "../container";
import { Logger } from "../logger";
import { MessageSource } from "../managers/realTimeMessage";
import {
	CreateChannelStreamRequest,
	CreateDirectStreamRequest,
	CreateMarkerLocationRequest,
	CreatePostRequest,
	CreateRepoRequest,
	DeletePostRequest,
	EditPostRequest,
	FetchFileStreamsRequest,
	FetchMarkerLocationsRequest,
	FetchMarkersRequest,
	FetchPostRepliesRequest,
	FetchPostsRequest,
	FetchStreamsRequest,
	FetchTeamsRequest,
	FetchUnreadStreamsRequest,
	FetchUsersRequest,
	FindRepoRequest,
	GetMarkerRequest,
	GetPostRequest,
	GetRepoRequest,
	GetStreamRequest,
	GetTeamRequest,
	GetUserRequest,
	InviteUserRequest,
	JoinStreamRequest,
	LeaveStreamRequest,
	MarkPostUnreadRequest,
	MarkStreamReadRequest,
	MessageType,
	ReactToPostRequest,
	UpdateMarkerRequest,
	UpdatePreferencesRequest,
	UpdatePresenceRequest,
	UpdateStreamMembershipRequest,
	UpdateStreamRequest
} from "../shared/agent.protocol";
import {
	CompleteSignupRequest,
	CSChannelStream,
	CSCreateChannelStreamRequest,
	CSCreateChannelStreamResponse,
	CSCreateDirectStreamRequest,
	CSCreateDirectStreamResponse,
	CSCreateMarkerLocationRequest,
	CSCreateMarkerLocationResponse,
	CSCreatePostRequest,
	CSCreatePostResponse,
	CSCreateRepoRequest,
	CSCreateRepoResponse,
	CSDeletePostResponse,
	CSDirectStream,
	CSEditPostRequest,
	CSEditPostResponse,
	CSFileStream,
	CSFindRepoResponse,
	CSGetMarkerLocationsResponse,
	CSGetMarkerResponse,
	CSGetMarkersResponse,
	CSGetMeResponse,
	CSGetPostResponse,
	CSGetPostsResponse,
	CSGetRepoResponse,
	CSGetReposResponse,
	CSGetStreamResponse,
	CSGetStreamsResponse,
	CSGetTeamResponse,
	CSGetTeamsResponse,
	CSGetUserResponse,
	CSGetUsersResponse,
	CSInviteUserRequest,
	CSInviteUserResponse,
	CSJoinStreamRequest,
	CSJoinStreamResponse,
	CSMarkPostUnreadRequest,
	CSMarkPostUnreadResponse,
	CSMePreferences,
	CSPush,
	CSReactions,
	CSReactToPostResponse,
	CSStream,
	CSUpdateMarkerRequest,
	CSUpdateMarkerResponse,
	CSUpdatePresenceRequest,
	CSUpdatePresenceResponse,
	CSUpdateStreamMembershipResponse,
	CSUpdateStreamRequest,
	CSUpdateStreamResponse,
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

	grantPubNubChannelAccess(token: string, channel: string): Promise<{}> {
		return this.put(`/grant/${channel}`, {}, token);
	}

	getMe() {
		return this.get<CSGetMeResponse>("/users/me", this._token);
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

	// async createFileStream(relativePath: string, repoId: string) {
	// 	return this.createStream<CSCreateFileStreamRequest, CSCreateFileStreamResponse>({
	// 		teamId: this._teamId,
	// 		type: StreamType.File,
	// 		repoId: repoId,
	// 		file: relativePath
	// 	});
	// }

	async fetchFileStreams(request: FetchFileStreamsRequest) {
		return this.get<CSGetStreamsResponse<CSFileStream>>(
			`/streams?teamId=${this.teamId}&repoId=${request.repoId}`,
			this._token
		);
	}

	createMarkerLocation(request: CreateMarkerLocationRequest) {
		return this.put<CSCreateMarkerLocationRequest, CSCreateMarkerLocationResponse>(
			`/marker-locations`,
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

	fetchMarkerLocations(request: FetchMarkerLocationsRequest) {
		return this.get<CSGetMarkerLocationsResponse>(
			`/marker-locations?teamId=${this.teamId}&streamId=${request.streamId}&commitHash=${
				request.commitHash
			}`,
			this._token
		);
	}

	fetchMarkers(request: FetchMarkersRequest) {
		// TODO: This doesn't handle all the request params
		return this.get<CSGetMarkersResponse>(
			`/markers?teamId=${this.teamId}&streamId=${request.streamId}${
				request.commitHash ? `&commitHash=${request.commitHash}` : ""
			}`,
			this._token
		);
	}

	getMarker(request: GetMarkerRequest) {
		return this.get<CSGetMarkerResponse>(
			`/markers/${request.markerId}?teamId=${this.teamId}`,
			this._token
		);
	}

	updateMarker(request: UpdateMarkerRequest) {
		return this.put<CSUpdateMarkerRequest, CSUpdateMarkerResponse>(
			`/markers/${request.markerId}`,
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
		const response = await this.delete<CSDeletePostResponse>(
			`/posts/${request.postId}`,
			this._token
		);

		// Container.instance().posts.resolve({
		// 	source: MessageSource.CodeStream,
		// 	type: MessageType.Posts,
		// 	changeSets: response
		// });
		const post = await this._cache.resolvePost(response.post);
		return { ...response, post: post };
	}

	async editPost(request: EditPostRequest) {
		const response = await this.put<CSEditPostRequest, CSEditPostResponse>(
			`/posts/${request.postId}`,
			request,
			this._token
		);

		const post = await this._cache.resolvePost(response.post);
		return { ...response, post: post };
	}

	fetchPostReplies(request: FetchPostRepliesRequest) {
		return this.get<CSGetPostsResponse>(
			`/posts?teamId=${this.teamId}?parentPostId=${request.postId}`,
			this._token
		);
	}

	async fetchPosts(request: FetchPostsRequest) {
		if (!request.limit || request.limit > 100) {
			request.limit = 100;
		}

		let params = `&limit=${request.limit}`;
		// TODO: Use once colin's new api is ready
		// if (request.before) {
		// 	params += `&before=${request.before}`;
		// }
		// if (request.after) {
		// 	params += `&after=${request.after}`;
		// }
		// if (request.inclusive === true) {
		// 	params += `&inclusive`;
		// }

		if (request.before && request.after && request.inclusive) {
			params += `&seqnum=${request.after}-${request.before}`;
		} else if (request.before && request.after) {
			params += `&seqnum=${request.after}-${request.before}`;
		} else if (request.before) {
			params += `&seqnum=${Math.max(+request.before - request.limit, 1)}-${request.before}`;
		} else if (request.after) {
			params += `seqnum=${request.after}-${+request.after + request.limit}`;
		}

		return this.get<CSGetPostsResponse>(
			`/posts?teamId=${this.teamId}&streamId=${request.streamId}${params}`,
			this._token
		);
	}

	getPost(request: GetPostRequest) {
		return this.get<CSGetPostResponse>(
			`/posts/${request.postId}?teamId=${this.teamId}`,
			this._token
		);
	}

	markPostUnread(request: MarkPostUnreadRequest) {
		return this.put<CSMarkPostUnreadRequest, CSMarkPostUnreadResponse>(
			`/unread/${request.postId}`,
			request,
			this._token
		);
	}

	async reactToPost(request: ReactToPostRequest) {
		const response = await this.put<CSReactions, CSReactToPostResponse>(
			`/react/${request.postId}`,
			request.emojis,
			this._token
		);

		const post = await this._cache.resolvePost(response.post);
		return { ...response, post: post };
	}

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

	findRepo(request: FindRepoRequest) {
		return this.get<CSFindRepoResponse>(
			`/no-auth/find-repo?url=${encodeURIComponent(
				request.url
			)}&knownCommitHashes=${request.firstCommitHashes.join(",")}&firstCommitHash=${
				request.firstCommitHashes[0]
			}`
		);
	}

	getRepo(request: GetRepoRequest) {
		return this.get<CSGetRepoResponse>(`/repos/${request.repoId}`, this._token);
	}

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

	fetchStreams(request: FetchStreamsRequest) {
		if (
			request.types == null ||
			request.types.length === 0 ||
			(request.types.includes(StreamType.Channel) && request.types.includes(StreamType.Direct))
		) {
			return this.get<CSGetStreamsResponse<CSChannelStream | CSDirectStream>>(
				`/streams?teamId=${this.teamId}`,
				this._token
			);
		}

		return this.get<CSGetStreamsResponse<CSChannelStream | CSDirectStream>>(
			`/streams?teamId=${this.teamId}&type=${request.types[0]}`,
			this._token
		);
	}

	fetchUnreadStreams(request: FetchUnreadStreamsRequest) {
		return this.get<CSGetStreamsResponse<CSChannelStream | CSDirectStream>>(
			`/streams?teamId=${this.teamId}&unread`,
			this._token
		);
	}

	async getStream(request: GetStreamRequest) {
		return this.get<CSGetStreamResponse<CSChannelStream | CSDirectStream>>(
			`/streams/${request.streamId}`,
			this._token
		);
	}

	async joinStream(request: JoinStreamRequest) {
		const response = await this.put<CSJoinStreamRequest, CSJoinStreamResponse>(
			`/join/${request.streamId}`,
			{},
			this._token
		);

		// const stream = Container.instance().streams.resolve({
		// 	source: MessageSource.CodeStream,
		// 	type: MessageType.Streams,
		// 	changeSets: response
		// });
		const stream = (await this._cache.resolveStream(response.stream)) as
			| CSChannelStream
			| CSDirectStream;
		return { stream: stream };
	}

	async leaveStream(request: LeaveStreamRequest) {
		const response = await this.updateStream({
			streamId: request.streamId,
			changes: {
				$pull: { memberIds: [this._userId] }
			}
		});

		// const stream = Container.instance().streams.resolve({
		// 	source: MessageSource.CodeStream,
		// 	type: MessageType.Streams,
		// 	changeSets: response
		// });
		const stream = (await this._cache.resolveStream(response.stream)) as
			| CSChannelStream
			| CSDirectStream;
		return { stream: stream };
	}

	markStreamRead(request: MarkStreamReadRequest) {
		return this.put(`/read/${request.streamId}`, {}, this._token);
	}

	async updateStream(request: UpdateStreamRequest) {
		const response = await this.put<CSUpdateStreamRequest, CSUpdateStreamResponse>(
			`/streams/${request.streamId}`,
			{ changes: request.changes },
			this._token
		);

		// const stream = Container.instance().streams.resolve({
		// 	source: MessageSource.CodeStream,
		// 	type: MessageType.Streams,
		// 	changeSets: response
		// });
		const stream = (await this._cache.resolveStream(response.stream)) as
			| CSChannelStream
			| CSDirectStream;
		return { stream: stream };
	}

	updateStreamMembership(request: UpdateStreamMembershipRequest) {
		return this.put<CSPush, CSUpdateStreamMembershipResponse>(
			`/streams/${request.streamId}`,
			request.push,
			this._token
		);
	}

	// // async addUserToStream(streamId: string, userId: string, teamId?: string) {
	// // 	return (await this._api.updateStreamMembership(this.token, teamId || this.teamId, streamId, {
	// // 		$push: userId
	// // 	})).stream;
	// // }

	fetchTeams(request: FetchTeamsRequest) {
		let params = "";
		if (request.mine) {
			params = `&mine`;
		}

		if (request.teamIds && request.teamIds.length) {
			params += `&ids=${request.teamIds.join(",")}`;
		}

		return this.get<CSGetTeamsResponse>(
			`/teams${params ? `?${params.substring(1)}` : ""}`,
			this._token
		);
	}

	getTeam(request: GetTeamRequest) {
		return this.get<CSGetTeamResponse>(`/teams/${request.teamId}`, this._token);
	}

	fetchUsers(request: FetchUsersRequest) {
		return this.get<CSGetUsersResponse>(`/users?teamId=${this.teamId}`, this._token);
	}

	getUser(request: GetUserRequest) {
		return this.get<CSGetUserResponse>(`/users/${request.userId}`, this._token);
	}

	inviteUser(request: InviteUserRequest) {
		return this.post<CSInviteUserRequest, CSInviteUserResponse>(
			"/users",
			{ ...request, teamId: this.teamId },
			this._token
		);
	}

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
