import EventEmitter, { IpcHost, IpcResponse } from "./event-emitter";
import {
	ArchiveStreamRequest,
	ArchiveStreamRequestType,
	ArchiveStreamResponse,
	AsanaCreateCardRequestType,
	BitbucketCreateCardRequestType,
	CloseStreamRequest,
	CloseStreamRequestType,
	CloseStreamResponse,
	CodeBlockSource,
	ConnectThirdPartyProviderRequest,
	ConnectThirdParyProviderRequestType,
	CreateChannelStreamRequest,
	CreateChannelStreamRequestType,
	CreateChannelStreamResponse,
	CreateDirectStreamRequest,
	CreateDirectStreamRequestType,
	CreateDirectStreamResponse,
	CreateJiraCardRequest,
	CreateJiraCardRequestType,
	CreateJiraCardResponse,
	CreatePostRequest,
	CreatePostRequestType,
	CreatePostResponse,
	CreatePostWithMarkerRequest,
	CreatePostWithMarkerRequestType,
	DeletePostRequest,
	DeletePostRequestType,
	DeletePostResponse,
	DisconnectThirdPartyProviderRequest,
	DisconnectThirdParyProviderRequestType,
	EditPostRequest,
	EditPostRequestType,
	EditPostResponse,
	FetchAssignableUsersRequest,
	FetchAssignableUsersRequestType,
	FetchCodemarksRequestType,
	FetchCodemarksResponse,
	FetchPostRepliesRequest,
	FetchPostRepliesRequestType,
	FetchPostRepliesResponse,
	FetchPostsRequest,
	FetchPostsRequestType,
	FetchPostsResponse,
	FetchThirdPartyBoardsRequest,
	GitHubCreateCardRequest,
	GitHubCreateCardRequestType,
	GitHubCreateCardResponse,
	GitLabCreateCardRequestType,
	InviteUserRequest,
	InviteUserRequestType,
	InviteUserResponse,
	JoinStreamRequest,
	JoinStreamRequestType,
	JoinStreamResponse,
	LeaveStreamRequest,
	LeaveStreamRequestType,
	LeaveStreamResponse,
	MarkPostUnreadRequest,
	MarkPostUnreadRequestType,
	MarkPostUnreadResponse,
	MarkStreamReadRequest,
	MarkStreamReadRequestType,
	MarkStreamReadResponse,
	MuteStreamRequest,
	MuteStreamRequestType,
	MuteStreamResponse,
	OpenStreamRequest,
	OpenStreamRequestType,
	OpenStreamResponse,
	ReactToPostRequest,
	ReactToPostRequestType,
	ReactToPostResponse,
	RenameStreamRequest,
	RenameStreamRequestType,
	RenameStreamResponse,
	ReportingMessageType,
	ReportMessageRequest,
	ReportMessageRequestType,
	SetStreamPurposeRequest,
	SetStreamPurposeRequestType,
	SetStreamPurposeResponse,
	TelemetryRequest,
	TelemetryRequestType,
	ThirdPartyProviderUser,
	TrelloCreateCardRequest,
	TrelloCreateCardRequestType,
	TrelloFetchListsRequest,
	TrelloFetchListsRequestType,
	UnarchiveStreamRequest,
	UnarchiveStreamRequestType,
	UnarchiveStreamResponse,
	UpdateCodemarkRequest,
	UpdateCodemarkRequestType,
	UpdateCodemarkResponse,
	UpdatePreferencesRequest,
	UpdatePreferencesRequestType,
	UpdatePreferencesResponse,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipRequestType,
	UpdateStreamMembershipResponse
} from "./shared/agent.protocol";
import { CodemarkType, CSMePreferences, StreamType } from "./shared/api.protocol.models";
import { shortUuid } from "./utils";

let sequence = 0;

export default class WebviewApi {
	pendingRequests = new Map();
	host: IpcHost;

	constructor() {
		this.host = EventEmitter.getHost();
		EventEmitter.on("response", ({ id, payload, error }: IpcResponse) => {
			const request = this.pendingRequests.get(id);
			if (request) {
				console.debug("codestream:response", { id, payload, error });
				if (payload !== undefined) request.resolve(payload);
				else {
					request.reject(
						error ||
							`No payload and no error provided by host process in response to ${request.action}`
					);
				}
				this.pendingRequests.delete(id);
			}
		});
	}

	postMessage<ResponseType>(message: { action: string; [key: string]: any }) {
		if (sequence === Number.MAX_SAFE_INTEGER) {
			sequence = 1;
		} else {
			sequence++;
		}

		const id = `${sequence}:${shortUuid()}`;
		return new Promise<ResponseType>((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject, action: message.action });
			console.debug("codestream:request", { id, ...message });
			this.host.postMessage({ type: "codestream:request", body: { id, ...message } }, "*");
		});
	}

	bootstrap() {
		return this.postMessage({ action: "bootstrap" });
	}

	startSignup() {
		return this.postMessage({ action: "go-to-signup" });
	}

	startSlackSignin() {
		return this.postMessage({ action: "go-to-slack-signin" });
	}

	connectService(service: string) {
		return this.postMessage({
			action: ConnectThirdParyProviderRequestType.method,
			params: {
				providerName: service
			} as ConnectThirdPartyProviderRequest
		});
	}

	disconnectService(service: string) {
		return this.postMessage({
			action: DisconnectThirdParyProviderRequestType.method,
			params: {
				providerName: service
			} as DisconnectThirdPartyProviderRequest
		});
	}

	createTrelloCard(listId: string, name: string, description: string) {
		return this.postMessage({
			action: TrelloCreateCardRequestType.method,
			params: {
				listId: listId,
				name: name,
				description: description
			} as TrelloCreateCardRequest
		});
	}

	createJiraCard(
		summary: string,
		description: string,
		issueType: string,
		project: string,
		assignees?: any[]
	) {
		return this.postMessage<CreateJiraCardResponse>({
			action: CreateJiraCardRequestType.method,
			params: {
				summary,
				description,
				issueType,
				project,
				assignees
			} as CreateJiraCardRequest
		});
	}

	createGithubCard(title: string, description: string, repoName: string) {
		return this.postMessage<GitHubCreateCardResponse>({
			action: GitHubCreateCardRequestType.method,
			params: {
				title,
				description,
				repoName
			} as GitHubCreateCardRequest
		});
	}

	createGitlabCard(title: string, description: string, repoName: string) {
		return this.postMessage({
			action: GitLabCreateCardRequestType.method,
			params: {
				title,
				description,
				repoName
			}
		});
	}

	createAsanaCard(boardId: number, listId: number, name: string, description: string) {
		return this.postMessage({
			action: AsanaCreateCardRequestType.method,
			params: {
				boardId,
				listId,
				name,
				description
			}
		});
	}

	createBitbucketCard(title: string, description: string, repoName: string) {
		return this.postMessage({
			action: BitbucketCreateCardRequestType.method,
			params: {
				title,
				description,
				repoName
			}
		});
	}

	// service is one of "trello", "asana", "jira", "github"
	fetchIssueBoards(service: string, organizationId?: string) {
		return this.postMessage({
			action: `codeStream/${service}/boards`,
			params: { organizationId: organizationId } as FetchThirdPartyBoardsRequest
		});
	}

	// so far trello is the only service with lists
	fetchIssueLists(service: string, boardId: string) {
		return this.postMessage({
			action: TrelloFetchListsRequestType.method,
			params: {
				boardId: boardId
			} as TrelloFetchListsRequest
		});
	}

	startJiraSignin() {
		return this.postMessage({ action: "go-to-jira-signin" });
	}

	startGitHubSignin() {
		return this.postMessage({ action: "go-to-github-signin" });
	}

	startAsanaSignin() {
		return this.postMessage({ action: "go-to-asana-signin" });
	}

	validateSignup(token: string) {
		return this.postMessage({ action: "validate-signup", params: token });
	}

	authenticate(params: object) {
		return this.postMessage({ action: "authenticate", params });
	}

	fetchPosts(params: FetchPostsRequest): Promise<FetchPostsResponse> {
		return this.postMessage({
			action: FetchPostsRequestType.method,
			params: params
		});
	}

	fetchThread(streamId: string, postId: string): Promise<FetchPostRepliesResponse> {
		return this.postMessage({
			action: FetchPostRepliesRequestType.method,
			params: { streamId, postId } as FetchPostRepliesRequest
		});
	}

	createPost(
		streamId: string,
		text: string,
		extras: { mentionedUserIds?: string[]; parentPostId?: string; entryPoint?: string } = {}
	): Promise<CreatePostResponse> {
		return this.postMessage({
			action: CreatePostRequestType.method,
			params: { streamId, text, ...extras } as CreatePostRequest
		});
	}

	createPostWithCodemark(
		streamId: string,
		extras: { mentionedUserIds?: string[]; parentPostId?: string } = {},
		codemark: {
			type: CodemarkType;
			markers: {
				code: string;
				location?: [number, number, number, number];
				source?: CodeBlockSource;
			}[];
			text?: string;
			assignees?: string[];
			title?: string;
			color?: string;
			externalProvider?: string;
			externalProviderUrl?: string;
			externalAssignees?: ThirdPartyProviderUser[];
		},
		extra: { fileUri: string; entryPoint?: string }
	): Promise<CreatePostResponse> {
		const block = codemark.markers[0] || {};
		const params: CreatePostWithMarkerRequest = {
			streamId,
			text: codemark.text || "",
			...extras,
			textDocument: { uri: extra.fileUri },
			code: block.code,
			rangeArray: block.location,
			source: block.source,
			title: codemark.title,
			type: codemark.type,
			assignees: codemark.assignees,
			color: codemark.color,
			externalProvider: codemark.externalProvider,
			externalAssignees: codemark.externalAssignees,
			externalProviderUrl: codemark.externalProviderUrl,
			entryPoint: extra.entryPoint
		};
		return this.postMessage({ action: CreatePostWithMarkerRequestType.method, params });
	}

	editPost(
		streamId: string,
		postId: string,
		text: string,
		mentionedUserIds: string[]
	): Promise<EditPostResponse> {
		return this.postMessage({
			action: EditPostRequestType.method,
			params: { streamId, postId, text, mentionedUserIds } as EditPostRequest
		});
	}

	reactToPost(
		streamId: string,
		postId: string,
		reactions: { [emoji: string]: boolean }
	): Promise<ReactToPostResponse> {
		return this.postMessage({
			action: ReactToPostRequestType.method,
			params: { streamId, postId, emojis: reactions } as ReactToPostRequest
		});
	}

	setPostStatus(params: object) {
		return this.postMessage({ action: "set-post-status", params });
	}

	deletePost(params: DeletePostRequest): Promise<DeletePostResponse> {
		return this.postMessage({ action: DeletePostRequestType.method, params });
	}

	createChannel(
		name: string,
		memberIds: string[],
		privacy: "public" | "private",
		purpose?: string
	): Promise<CreateChannelStreamResponse> {
		return this.postMessage({
			action: CreateChannelStreamRequestType.method,
			params: {
				type: StreamType.Channel,
				name,
				memberIds,
				privacy,
				purpose
			} as CreateChannelStreamRequest
		});
	}

	createDirectMessage(memberIds: string[]): Promise<CreateDirectStreamResponse> {
		return this.postMessage({
			action: CreateDirectStreamRequestType.method,
			params: { type: StreamType.Direct, memberIds } as CreateDirectStreamRequest
		});
	}

	renameStream(streamId: string, name: string): Promise<RenameStreamResponse> {
		return this.postMessage({
			action: RenameStreamRequestType.method,
			params: { streamId, name } as RenameStreamRequest
		});
	}

	setStreamPurpose(streamId: string, purpose: string): Promise<SetStreamPurposeResponse> {
		return this.postMessage({
			action: SetStreamPurposeRequestType.method,
			params: { streamId, purpose } as SetStreamPurposeRequest
		});
	}

	joinStream(streamId: string): Promise<JoinStreamResponse> {
		return this.postMessage({
			action: JoinStreamRequestType.method,
			params: { streamId } as JoinStreamRequest
		});
	}

	leaveStream(streamId: string): Promise<LeaveStreamResponse> {
		return this.postMessage({
			action: LeaveStreamRequestType.method,
			params: { streamId } as LeaveStreamRequest
		});
	}

	archiveStream(streamId: string): Promise<ArchiveStreamResponse> {
		return this.postMessage({
			action: ArchiveStreamRequestType.method,
			params: { streamId } as ArchiveStreamRequest
		});
	}

	unarchiveStream(streamId: string): Promise<UnarchiveStreamResponse> {
		return this.postMessage({
			action: UnarchiveStreamRequestType.method,
			params: { streamId } as UnarchiveStreamRequest
		});
	}

	removeUsersFromStream(
		streamId: string,
		userIds: string[]
	): Promise<UpdateStreamMembershipResponse> {
		return this.postMessage({
			action: UpdateStreamMembershipRequestType.method,
			params: { streamId, remove: userIds } as UpdateStreamMembershipRequest
		});
	}

	addUsersToStream(streamId: string, userIds: string[]): Promise<UpdateStreamMembershipResponse> {
		return this.postMessage({
			action: UpdateStreamMembershipRequestType.method,
			params: { streamId, add: userIds } as UpdateStreamMembershipRequest
		});
	}

	invite(attributes: { email: string; fullName?: string }): Promise<InviteUserResponse> {
		return this.postMessage({
			action: InviteUserRequestType.method,
			params: attributes as InviteUserRequest
		});
	}

	markStreamRead(streamId: string, postId?: string): Promise<MarkStreamReadResponse> {
		return this.postMessage({
			action: MarkStreamReadRequestType.method,
			params: { streamId, postId } as MarkStreamReadRequest
		});
	}

	markPostUnread(streamId: string, postId: string): Promise<MarkPostUnreadResponse> {
		return this.postMessage({
			action: MarkPostUnreadRequestType.method,
			params: { streamId, postId } as MarkPostUnreadRequest
		});
	}

	showMarkersInEditor(value: Boolean) {
		return this.postMessage({
			action: "show-markers",
			params: value
		});
	}

	muteAllConversations(value: Boolean) {
		return this.postMessage({
			action: "mute-all",
			params: value
		});
	}

	openCommentOnSelectInEditor(value: Boolean) {
		return this.postMessage({
			action: "open-comment-on-select",
			params: value
		});
	}

	saveUserPreference(newPreference: CSMePreferences): Promise<UpdatePreferencesResponse> {
		return this.postMessage({
			action: UpdatePreferencesRequestType.method,
			params: newPreference as UpdatePreferencesRequest
		});
	}

	showCode(marker: object, enteringThread: boolean, source: string = "Source File") {
		return this.postMessage({ action: "show-code", params: { marker, enteringThread, source } });
	}

	highlightCode(marker: object, onOff: boolean, source: string = "stream") {
		return this.postMessage({ action: "highlight-code", params: { marker, onOff, source } });
	}

	startCommentOnLine(line: number, uri) {
		return this.postMessage({ action: "start-comment-on-line", params: { line, uri } });
	}

	closeDirectMessage(streamId: string): Promise<CloseStreamResponse> {
		return this.postMessage({
			action: CloseStreamRequestType.method,
			params: { streamId } as CloseStreamRequest
		});
	}

	openDirectMessage(streamId: string): Promise<OpenStreamResponse> {
		return this.postMessage({
			action: OpenStreamRequestType.method,
			params: { streamId } as OpenStreamRequest
		});
	}

	changeStreamMuteState(streamId: string, mute: boolean): Promise<MuteStreamResponse> {
		return this.postMessage({
			action: MuteStreamRequestType.method,
			params: { streamId, mute } as MuteStreamRequest
		});
	}

	editCodemark(
		id: string,
		params: {
			text?: string;
			title?: string;
			color?: string;
			assignees?: string[];
		}
	): Promise<UpdateCodemarkResponse> {
		return this.postMessage({
			action: UpdateCodemarkRequestType.method,
			params: { codemarkId: id, ...params } as UpdateCodemarkRequest
		});
	}

	fetchCodemarks(): Promise<FetchCodemarksResponse> {
		return this.postMessage({ action: FetchCodemarksRequestType.method, params: {} });
	}

	setCodemarkStatus(id: string, status: string): Promise<UpdateCodemarkResponse> {
		return this.postMessage({
			action: UpdateCodemarkRequestType.method,
			params: {
				codemarkId: id,
				status
			} as UpdateCodemarkRequest
		});
	}

	sendTelemetry(params: TelemetryRequest): Promise<void> {
		return this.postMessage({
			action: TelemetryRequestType.method,
			params
		});
	}

	reportMessage(type: ReportingMessageType, message: string, extra?: {}): Promise<void> {
		const params: ReportMessageRequest = { source: "webview", type, message, extra };
		return this.postMessage({
			action: ReportMessageRequestType.method,
			params
		});
	}

	editorRevealLine(line: number) {
		return this.postMessage({ action: "reveal-line", params: { line } });
	}

	fetchAssignableUsers(service: string, boardId: string) {
		return this.postMessage({
			action: FetchAssignableUsersRequestType.method,
			params: { providerName: service, boardId } as FetchAssignableUsersRequest
		});
	}
}
