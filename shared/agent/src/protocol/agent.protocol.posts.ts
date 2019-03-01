"use strict";
import { Range, RequestType, TextDocumentIdentifier } from "vscode-languageserver-protocol";
import { CodemarkPlus, CreateCodemarkRequest } from "./agent.protocol.markers";
import { ThirdPartyProviderUser } from "./agent.protocol.providers";
import {
	CodemarkType,
	CSCodemark,
	CSCreatePostRequestCodeBlock,
	CSCreatePostRequestStream,
	CSMarker,
	CSMarkerLocations,
	CSPost,
	CSReactions,
	CSRepository,
	CSStream
} from "./api.protocol";

export interface PostPlus extends CSPost {
	codemark?: CodemarkPlus;
	hasMarkers?: boolean;
}

export interface CreatePostRequest {
	streamId: string;
	text: string;
	mentionedUserIds?: string[];
	parentPostId?: string;
	codemark?: CreateCodemarkRequest;
	entryPoint?: string;
}

export interface CreatePostInFileStreamRequest {
	stream: CSCreatePostRequestStream;
	text: string;
	mentionedUserIds?: string[];
	parentPostId?: string;
	codeBlocks?: CSCreatePostRequestCodeBlock[];
	commitHashWhenPosted?: string;
}

export interface CreatePostResponse {
	post: PostPlus;
	codemark?: CodemarkPlus;
	markers?: CSMarker[];
	markerLocations?: CSMarkerLocations[];
	streams?: CSStream[];
	repos?: CSRepository[];
}

export const CreatePostRequestType = new RequestType<
	CreatePostRequest,
	CreatePostResponse,
	void,
	void
>("codestream/posts/create");

export interface CodeBlockSource {
	file: string;
	repoPath: string;
	revision: string;
	authors: { id: string; username: string }[];
	remotes: { name: string; url: string }[];
}

export interface CreatePostWithMarkerRequest {
	textDocument: TextDocumentIdentifier;
	text: string;
	mentionedUserIds?: string[];
	code: string;
	range?: Range;
	source?: CodeBlockSource;
	parentPostId?: string;
	streamId: string;
	title?: string;
	type: CodemarkType;
	assignees?: string[];
	color?: string;
	status?: string;
	externalProvider?: string;
	externalProviderUrl?: string;
	externalAssignees?: ThirdPartyProviderUser[];
	entryPoint?: string;
}

export const CreatePostWithMarkerRequestType = new RequestType<
	CreatePostWithMarkerRequest,
	CreatePostResponse,
	void,
	void
>("codestream/posts/createWithCodemark");

export interface FetchPostRepliesRequest {
	streamId: string;
	postId: string;
}

export interface FetchPostRepliesResponse {
	posts: CSPost[];
	codemarks?: CSCodemark[];
}

export const FetchPostRepliesRequestType = new RequestType<
	FetchPostRepliesRequest,
	FetchPostRepliesResponse,
	void,
	void
>("codestream/post/replies");

export interface FetchPostsRequest {
	streamId: string;
	limit?: number;
	after?: number | string; // equiv to slack.oldest
	before?: number | string; // equiv to slack.latest
	inclusive?: boolean;
}

export interface FetchPostsResponse {
	posts: PostPlus[];
	codemarks?: CSCodemark[];
	markers?: CSMarker[];
	more?: boolean;
}

export const FetchPostsRequestType = new RequestType<
	FetchPostsRequest,
	FetchPostsResponse,
	void,
	void
>("codestream/posts");

export interface DeletePostRequest {
	streamId: string;
	postId: string;
}

export interface DeletePostResponse {
	post: CSPost;
}

export const DeletePostRequestType = new RequestType<
	DeletePostRequest,
	DeletePostResponse,
	void,
	void
>("codestream/post/delete");

export interface EditPostRequest {
	streamId: string;
	postId: string;
	text: string;
	mentionedUserIds?: string[];
}

export interface EditPostResponse {
	post: CSPost;
}

export const EditPostRequestType = new RequestType<EditPostRequest, EditPostResponse, void, void>(
	"codestream/post/edit"
);

export interface GetPostRequest {
	streamId: string;
	postId: string;
}

export interface GetPostResponse {
	post: CSPost;
}

export const GetPostRequestType = new RequestType<GetPostRequest, GetPostResponse, void, void>(
	"codestream/post"
);

export interface MarkPostUnreadRequest {
	streamId: string;
	postId: string;
}

export interface MarkPostUnreadResponse {}

export const MarkPostUnreadRequestType = new RequestType<
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	void,
	void
>("codestream/post/markUnread");

export interface PreparePostWithCodeRequest {
	textDocument: TextDocumentIdentifier;
	range: Range;
	dirty: boolean;
}

export interface PreparePostWithCodeResponse {
	code: string;
	range: Range;
	source?: CodeBlockSource;
	gitError?: string;
}

export const PreparePostWithCodeRequestType = new RequestType<
	PreparePostWithCodeRequest,
	PreparePostWithCodeResponse,
	void,
	void
>("codestream/post/prepareWithCode");

export interface ReactToPostRequest {
	streamId: string;
	postId: string;
	emojis: CSReactions;
}

export interface ReactToPostResponse {
	post: CSPost;
}

export const ReactToPostRequestType = new RequestType<
	ReactToPostRequest,
	ReactToPostResponse,
	void,
	void
>("codestream/post/react");
