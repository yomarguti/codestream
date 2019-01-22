"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface GitHubCreateCardRequest {
	repoName: string;
	title: string;
	description: string;
	assignees?: [{ login: string }];
}

export interface GitHubCreateCardResponse {
	id: string;
	html_url: string;
}

export const GitHubCreateCardRequestType = new RequestType<
	GitHubCreateCardRequest,
	GitHubCreateCardResponse,
	void,
	void
>("codeStream/github/cards/create");

export interface GitHubFetchBoardsRequest {
	organizationId?: string;
}

export interface GitHubBoard {
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
	// lists: GitHubList[];
}

export interface GitHubFetchBoardsResponse {
	boards: GitHubBoard[];
}

export const GitHubFetchBoardsRequestType = new RequestType<
	GitHubFetchBoardsRequest,
	GitHubFetchBoardsResponse,
	void,
	void
>("codeStream/github/boards");

export interface GitHubFetchListsRequest {
	boardId: string;
}

export interface GitHubList {
	id: string;
	name: string;
	closed: boolean;
	idBoard: string;
	pos: number;
	subscribed: boolean;
}

export interface GitHubFetchListsResponse {
	lists: GitHubList[];
}

export const GitHubFetchListsRequestType = new RequestType<
	GitHubFetchListsRequest,
	GitHubFetchListsResponse,
	void,
	void
>("codeStream/github/lists");

export interface GitHubUser {
	id: string;
	login: string;
}