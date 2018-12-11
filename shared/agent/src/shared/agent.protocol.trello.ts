"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface TrelloCreateCardRequest {
	organizationId: string;
	boardId: string;
	listId: string;
}

export interface TrelloCreateCardResponse {
	id: string;
}

export const TrelloCreateCardRequestType = new RequestType<
	TrelloCreateCardRequest,
	TrelloCreateCardResponse,
	void,
	void
>("codeStream/trello/cards/create");

export interface TrelloFetchBoardsRequest {
	organizationId: string;
}

export interface TrelloFetchBoardsResponse {
	boards: any[];
}

export const TrelloFetchBoardsRequestType = new RequestType<
	TrelloFetchBoardsRequest,
	TrelloFetchBoardsResponse,
	void,
	void
>("codeStream/trello/boards");

export interface TrelloFetchListsRequest {
	organizationId: string;
	boardId: string;
}

export interface TrelloFetchListsResponse {
	lists: any[];
}

export const TrelloFetchListsRequestType = new RequestType<
	TrelloFetchListsRequest,
	TrelloFetchListsResponse,
	void,
	void
>("codeStream/trello/lists");

export interface TrelloAuthRequest {}

export interface TrelloAuthResponse {
	organizationId: string;
}

export const TrelloAuthRequestType = new RequestType<
	TrelloAuthRequest,
	TrelloAuthResponse,
	void,
	void
>("codeStream/trello/auth");
