"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface BitbucketCreateCardRequest {
	repoName: string;
	title: string;
	description: string;
}

export interface BitbucketCreateCardResponse {
	id: string;
}

export const BitbucketCreateCardRequestType = new RequestType<
	BitbucketCreateCardRequest,
	BitbucketCreateCardResponse,
	void,
	void
>("codeStream/bitbucket/cards/create");

export interface BitbucketFetchBoardsRequest {
	organizationId?: string;
}

export interface BitbucketBoard {
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
	// lists: BitbucketList[];
}

export interface BitbucketFetchBoardsResponse {
	boards: BitbucketBoard[];
}

export const BitbucketFetchBoardsRequestType = new RequestType<
	BitbucketFetchBoardsRequest,
	BitbucketFetchBoardsResponse,
	void,
	void
>("codeStream/bitbucket/boards");

export interface BitbucketFetchListsRequest {
	boardId: string;
}

export interface BitbucketList {
	id: string;
	name: string;
	closed: boolean;
	idBoard: string;
	pos: number;
	subscribed: boolean;
}

export interface BitbucketFetchListsResponse {
	lists: BitbucketList[];
}

export const BitbucketFetchListsRequestType = new RequestType<
	BitbucketFetchListsRequest,
	BitbucketFetchListsResponse,
	void,
	void
>("codeStream/bitbucket/lists");
