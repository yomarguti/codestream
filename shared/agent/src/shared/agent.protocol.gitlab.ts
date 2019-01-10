"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface GitLabCreateCardRequest {
	repoName: string;
	title: string;
	description: string;
}

export interface GitLabCreateCardResponse {
	id: string;
}

export const GitLabCreateCardRequestType = new RequestType<
	GitLabCreateCardRequest,
	GitLabCreateCardResponse,
	void,
	void
>("codeStream/gitlab/cards/create");

export interface GitLabFetchBoardsRequest {
	organizationId?: string;
}

export interface GitLabBoard {
	id: string;
	name: string;
	// desc: string;
	// descData: string;
	// closed: boolean;
	// idOrganization: string;
	// pinned: boolean;
	// url: string;
	// labelNames: { [color: string]: string };
	// starred: boolean;
	// lists: GitLabList[];
}

export interface GitLabFetchBoardsResponse {
	boards: GitLabBoard[];
}

export const GitLabFetchBoardsRequestType = new RequestType<
	GitLabFetchBoardsRequest,
	GitLabFetchBoardsResponse,
	void,
	void
>("codeStream/gitlab/boards");

export interface GitLabFetchListsRequest {
	boardId: string;
}

export interface GitLabList {
	id: string;
	name: string;
	closed: boolean;
	idBoard: string;
	pos: number;
	subscribed: boolean;
}

export interface GitLabFetchListsResponse {
	lists: GitLabList[];
}

export const GitLabFetchListsRequestType = new RequestType<
	GitLabFetchListsRequest,
	GitLabFetchListsResponse,
	void,
	void
>("codeStream/gitlab/lists");
