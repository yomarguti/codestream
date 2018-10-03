import { Uri } from "vscode";
import { Disposable } from "vscode-jsonrpc";
import { ChannelServiceType } from "../shared/api.protocol";
import {
	ApiMiddleware,
	CSChannelStream,
	CSDirectStream,
	CSFileStream,
	CSMarker,
	CSMarkerLocations,
	CSPost,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser,
	PresenceStatus
} from "./api";
export interface ApiProvider {
	baseUrl: string;
	useMiddleware(middleware: ApiMiddleware): Disposable;
	savePreferences(preferences: {}): Promise<CSUser>;
	getMe(): Promise<CSUser>;
	invite(email: string, teamId: string, fullName?: string): Promise<CSUser>;
	createPost(
		text: string,
		mentionedUserIds: string[],
		parentPostId: string | undefined,
		streamId: string,
		teamId?: string
	): Promise<CSPost | undefined>;
	createChannelStream(
		name: string,
		membership?: "auto" | string[],
		privacy?: "public" | "private",
		purpose?: string,
		service?: {
			serviceType: ChannelServiceType;
			serviceKey?: string;
			serviceInfo?: {
				[key: string]: any;
			};
		},
		teamId?: string
	): Promise<CSChannelStream | undefined>;
	createDirectStream(membership: string[], teamId?: string): Promise<CSDirectStream | undefined>;
	createFileStream(
		relativeUri: Uri,
		repoId: string,
		teamId?: string
	): Promise<CSFileStream | undefined>;
	createFileStream(
		relativePath: string,
		repoId: string,
		teamId?: string
	): Promise<CSFileStream | undefined>;
	createFileStream(
		relativeUriOrPath: Uri | string,
		repoId: string,
		teamId?: string
	): Promise<CSFileStream | undefined>;
	deletePost(streamId: string, postId: string, teamId?: string): Promise<CSPost>;
	editPost(
		streamId: string,
		postId: string,
		text: string,
		mentionedUserIds: string[]
	): Promise<CSPost>;
	reactToPost(streamId: string, postId: string, emoji: string, value: boolean): Promise<CSPost>;
	markPostUnread(streamId: string, postId: string): Promise<CSPost>;
	getMarker(markerId: string, teamId?: string): Promise<CSMarker>;
	getMarkers(commitHash: string, streamId: string, teamId?: string): Promise<CSMarker[]>;
	getMarkerLocations(
		commitHash: string,
		streamId: string,
		teamId?: string
	): Promise<CSMarkerLocations>;
	getPost(streamId: string, postId: string, teamId?: string): Promise<CSPost>;
	getLatestPost(streamId: string, teamId?: string): Promise<CSPost>;
	getPostsInRange(streamId: string, start: number, end: number, teamId?: string): Promise<CSPost[]>;
	getPosts(
		streamId: string,
		limit?: number,
		beforeSeq?: number,
		teamId?: string
	): Promise<CSPost[]>;
	getRepo(repoId: string, teamId?: string): Promise<CSRepository | undefined>;
	getRepos(teamId?: string): Promise<CSRepository[]>;
	getStream(streamId: string, teamId?: string): Promise<CSStream | undefined>;
	getUnreadStreams(teamId?: string): Promise<CSStream[]>;
	getChannelStreams(teamId?: string): Promise<CSChannelStream[]>;
	getChannelOrDirectStreams(teamId?: string): Promise<(CSChannelStream | CSDirectStream)[]>;
	getDirectStreams(teamId?: string): Promise<CSDirectStream[]>;
	getFileStreams(repoId: string, teamId?: string): Promise<CSFileStream[]>;
	getTeam(teamId: string): Promise<CSTeam | undefined>;
	getTeams(ids: string[]): Promise<CSTeam[]>;
	getUser(userId: string, teamId?: string): Promise<CSUser | undefined>;
	getUsers(teamId?: string): Promise<CSUser[]>;
	joinStream(streamId: string, teamId?: string): Promise<CSStream>;
	leaveStream(streamId: string, teamId?: string): Promise<CSStream>;
	updateStream(streamId: string, update: object): Promise<CSStream>;
	updatePresence(status: PresenceStatus, sessionId: string): Promise<number>;
	markStreamRead(streamId: string): Promise<{}>;
}
