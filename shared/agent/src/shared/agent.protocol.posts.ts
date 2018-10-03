"use strict";
import { Range, RequestType, TextDocumentIdentifier } from "vscode-languageserver-protocol";
import {
	CreatePostRequestCodeBlock,
	CreatePostRequestStream,
	CSPost,
	DeletePostResponse,
	EditPostRequest,
	EditPostResponse,
	GetPostResponse,
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	ReactToPostRequest,
	ReactToPostResponse
} from "./api.protocol";

export interface CreatePostRequest {
	streamId?: string;
	stream?: CreatePostRequestStream;
	parentPostId?: string;
	text: string;
	codeBlocks?: CreatePostRequestCodeBlock[];
	commitHashWhenPosted?: string;
	mentionedUserIds?: string[];
}

export interface CreatePostResponse {
	post: CSPost;
}

export const CreatePostRequestType = new RequestType<
	CreatePostRequest,
	CreatePostResponse,
	void,
	void
>("codeStream/posts/create");

export interface CodeBlockSource {
	file: string;
	repoPath: string;
	revision: string;
	authors: { id: string; username: string }[];
	remotes: { name: string; url: string }[];
}

export interface CreatePostWithCodeRequest {
	textDocument: TextDocumentIdentifier;
	text: string;
	mentionedUserIds: string[];
	code: string;
	location?: [number, number, number, number];
	source?: CodeBlockSource;
	parentPostId?: string;
	streamId: string;
}

export const CreatePostWithCodeRequestType = new RequestType<
	CreatePostWithCodeRequest,
	CSPost,
	void,
	void
>("codeStream/posts/createWithCode");
export interface FetchPostsRequest {
	streamId: string;
	limit: number;
	beforeSeq?: number;
	afterSeq?: number;
}

export interface FetchPostsResponse {
	posts: CSPost[];
	maxSeq: number;
}

export const FetchPostsRequestType = new RequestType<
	FetchPostsRequest,
	FetchPostsResponse,
	void,
	void
>("codeStream/posts");

// export interface GetPostsInRangeRequest {
// 	streamId: string;
// 	range: string;
// }

// export interface GetPostsInRangeResponse {
// 	posts: CSPost[];
// 	more?: boolean;
// }

// export const GetPostsInRangeRequestType = new RequestType<
// 	GetPostsInRangeRequest,
// 	GetPostsInRangeResponse,
// 	void,
// 	void
// >("codeStream/getPostsInRange");

export interface FetchLatestPostRequest {
	streamId: string;
}

export interface FetchLatestPostResponse {
	post: CSPost;
}

export const FetchLatestPostRequestType = new RequestType<
	FetchLatestPostRequest,
	FetchLatestPostResponse,
	void,
	void
>("codeStream/posts/latest");

export interface DeletePostRequest {
	streamId: string;
	id: string;
}

export const DeletePostRequestType = new RequestType<
	DeletePostRequest,
	DeletePostResponse,
	void,
	void
>("codeStream/post/delete");

export const EditPostRequestType = new RequestType<EditPostRequest, EditPostResponse, void, void>(
	"codeStream/post/edit"
);

export interface GetPostRequest {
	streamId: string;
	id: string;
}

export const GetPostRequestType = new RequestType<GetPostRequest, GetPostResponse, void, void>(
	"codeStream/post"
);

export const MarkPostUnreadRequestType = new RequestType<
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	void,
	void
>("codeStream/post/markUnread");

export interface PreparePostWithCodeRequest {
	textDocument: TextDocumentIdentifier;
	range: Range;
	dirty: boolean;
}

export interface PreparePostWithCodeResponse {
	code: string;
	source?: CodeBlockSource;
	gitError?: string;
}

export const PreparePostWithCodeRequestType = new RequestType<
	PreparePostWithCodeRequest,
	PreparePostWithCodeResponse,
	void,
	void
>("codeStream/post/prepareWithCode");

export const ReactToPostRequestType = new RequestType<
	ReactToPostRequest,
	ReactToPostResponse,
	void,
	void
>("codeStream/post/react");
