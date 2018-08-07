"use strict";
import { RequestInit } from "node-fetch";
import { Container } from "../container";
import {
	CreatePostRequest,
	CreatePostResponse,
	CreateRepoRequest,
	CreateRepoResponse,
	CreateStreamRequest,
	CreateStreamResponse,
	CSStream,
	DeletePostResponse,
	EditPostRequest,
	EditPostResponse,
	FindRepoResponse,
	GetMarkerLocationsResponse,
	GetMarkerResponse,
	GetMarkersResponse,
	GetPostResponse,
	GetPostsResponse,
	GetRepoResponse,
	GetReposResponse,
	GetStreamResponse,
	GetStreamsResponse,
	GetTeamResponse,
	GetTeamsResponse,
	GetUserResponse,
	GetUsersResponse,
	InviteRequest,
	InviteResponse,
	JoinStreamRequest,
	JoinStreamResponse,
	MeResponse,
	UpdatePresenceRequest,
	UpdatePresenceResponse,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse
} from "../shared/api.protocol";

export * from "../shared/api.protocol";

export interface ApiMiddlewareContext {
	readonly url: string;
	readonly method: string;
	readonly request: RequestInit | undefined;
}

export interface ApiMiddleware {
	readonly name: string;
	onRequest?(context: ApiMiddlewareContext): Promise<void>;
	onProvideResponse?(context: ApiMiddlewareContext): Promise<any | undefined>;
	onResponse?(context: ApiMiddlewareContext, response: Promise<any>): Promise<void>;
}

export class CodeStreamApi {
	private readonly _middleware: ApiMiddleware[] = [];
	// private responseCache = new Map<string, Promise<any>>();

	constructor(public baseUrl: string) {
		// this.useMiddleware({
		//     name: 'ResponseCaching',
		//     onProvideResponse: async context => {
		//         if (context.method !== 'GET') return undefined;
		//         return this.responseCache.get(context.url);
		//     },
		//     onResponse: async (context, response) => {
		//         if (context.method !== 'GET') return;
		//         this.responseCache.set(context.url, response);
		//     }
		// });
	}

	useMiddleware(middleware: ApiMiddleware) {
		this._middleware.push(middleware);
		return {
			dispose: () => {
				const i = this._middleware.indexOf(middleware);
				this._middleware.splice(i, 1);
			}
		};
	}

	createPost(token: string, request: CreatePostRequest): Promise<CreatePostResponse> {
		return this.post<CreatePostRequest, CreatePostResponse>(`/posts`, request, token);
	}

	createRepo(token: string, request: CreateRepoRequest): Promise<CreateRepoResponse> {
		return this.post<CreateRepoRequest, CreateRepoResponse>(`/repos`, request, token);
	}

	createStream(token: string, request: CreateStreamRequest): Promise<CreateStreamResponse> {
		return this.post<CreateStreamRequest, CreateStreamResponse>(`/streams`, request, token);
	}

	deletePost(token: string, teamId: string, postId: string) {
		return this.delete<DeletePostResponse>(`/posts/${postId}`, token);
	}

	editPost(token: string, request: EditPostRequest) {
		return this.put<EditPostRequest, EditPostResponse>(`/posts/${request.id}`, request, token);
	}

	findRepo(url: string, firstCommitHashes: string[]) {
		return this.get<FindRepoResponse>(
			`/no-auth/find-repo?url=${encodeURIComponent(url)}&knownCommitHashes=${firstCommitHashes.join(
				","
			)}&firstCommitHash=${firstCommitHashes[0]}`
		);
	}

	getMarker(token: string, teamId: string, markerId: string): Promise<GetMarkerResponse> {
		return this.get<GetMarkerResponse>(`/markers/${markerId}?teamId=${teamId}`, token);
	}

	getMarkerLocations(
		token: string,
		teamId: string,
		streamId: string,
		commitHash: string
	): Promise<GetMarkerLocationsResponse> {
		return this.get<GetMarkerLocationsResponse>(
			`/marker-locations?teamId=${teamId}&streamId=${streamId}&commitHash=${commitHash}`,
			token
		);
	}

	getMarkers(token: string, teamId: string, streamId: string): Promise<GetMarkersResponse> {
		return this.get<GetMarkersResponse>(`/markers?teamId=${teamId}&streamId=${streamId}`, token);
	}

	getPost(token: string, teamId: string, postId: string): Promise<GetPostResponse> {
		return this.get<GetPostResponse>(`/posts/${postId}?teamId=${teamId}`, token);
	}

	getLatestPost(token: string, teamId: string, streamId: string): Promise<GetPostsResponse> {
		return this.get<GetPostsResponse>(
			`/posts/?teamId=${teamId}&streamId=${streamId}&limit=1`,
			token
		);
	}

	getPostsInRange(
		token: string,
		teamId: string,
		streamId: string,
		range: string
	): Promise<GetPostsResponse> {
		return this.get<GetPostsResponse>(
			`/posts/?teamId=${teamId}&streamId=${streamId}&seqnum=${range}`,
			token
		);
	}

	getPosts(token: string, teamId: string, streamId: string): Promise<GetPostsResponse> {
		return this.get<GetPostsResponse>(`/posts?teamId=${teamId}&streamId=${streamId}`, token);
	}

	getRepo(token: string, teamId: string, repoId: string): Promise<GetRepoResponse> {
		return this.get<GetRepoResponse>(`/repos/${repoId}`, token);
	}

	getRepos(token: string, teamId: string): Promise<GetReposResponse> {
		return this.get<GetReposResponse>(`/repos?teamId=${teamId}`, token);
	}

	getStream<T extends CSStream>(
		token: string,
		teamId: string,
		streamId: string
	): Promise<GetStreamResponse<T>> {
		return this.get<GetStreamResponse<T>>(`/streams/${streamId}`, token);
	}

	getStreams<T extends CSStream>(
		token: string,
		teamId: string,
		repoId?: string
	): Promise<GetStreamsResponse<T>> {
		return this.get<GetStreamsResponse<T>>(
			`/streams?teamId=${teamId}${repoId === undefined ? "" : `&repoId=${repoId}`}`,
			token
		);
	}

	getTeam(token: string, teamId: string): Promise<GetTeamResponse> {
		return this.get<GetTeamResponse>(`/teams/${teamId}`, token);
	}

	getTeams(token: string, teamIds: string[]): Promise<GetTeamsResponse> {
		return this.get<GetTeamsResponse>(`/teams?ids=${teamIds.join(",")}`, token);
	}

	getUser(token: string, teamId: string, userId: string): Promise<GetUserResponse> {
		return this.get<GetUserResponse>(`/users/${userId}`, token);
	}

	getUsers(token: string, teamId: string): Promise<GetUsersResponse> {
		return this.get<GetUsersResponse>(`/users?teamId=${teamId}`, token);
	}

	joinStream(token: string, teamId: string, streamId: string, request: JoinStreamRequest) {
		return this.put<JoinStreamRequest, JoinStreamResponse>(`/join/${streamId}`, request, token);
	}

	updateStream(token: string, streamId: string, request: object) {
		return this.put(`/streams/${streamId}`, request, token);
	}

	updatePresence(token: string, request: UpdatePresenceRequest) {
		return this.put<UpdatePresenceRequest, UpdatePresenceResponse>(`/presence`, request, token);
	}

	updateStreamMembership(
		token: string,
		teamId: string,
		streamId: string,
		request: UpdateStreamMembershipRequest
	) {
		return this.put<UpdateStreamMembershipRequest, UpdateStreamMembershipResponse>(
			`/streams/${streamId}`,
			request,
			token
		);
	}

	invite(token: string, request: InviteRequest) {
		return this.post<InviteRequest, InviteResponse>("/users", request, token);
	}

	markStreamRead(token: string, streamId: string) {
		return this.put(`/read/${streamId}`, {}, token);
	}

	savePreferences(token: string, preferences: {}) {
		return this.put("/preferences", preferences, token);
	}

	getMe(token: string) {
		return this.get<MeResponse>("/users/me", token);
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

	private async fetch<R extends object>(
		url: string,
		init?: RequestInit,
		token?: string
	): Promise<R> {
		return Container.agent.api<R>(url, init, token);
	}

	static normalizeResponse<R extends object>(obj: { [key: string]: any }): R {
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

		return obj as R;
	}
}
