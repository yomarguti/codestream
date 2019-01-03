"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface TrelloCreateCardRequest {
	listId: string;

	name: string;
	description: string;
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
	organizationId?: string;
}

export interface TrelloBoard {
	id: string;
	name: string;
	desc: string;
	descData: string;
	closed: boolean;
	idOrganization: string;
	pinned: boolean;
	url: string;
	labelNames: { [color: string]: string };
	starred: boolean;
	lists: TrelloList[];
}

export interface TrelloFetchBoardsResponse {
	boards: TrelloBoard[];
}

export const TrelloFetchBoardsRequestType = new RequestType<
	TrelloFetchBoardsRequest,
	TrelloFetchBoardsResponse,
	void,
	void
>("codeStream/trello/boards");

export interface TrelloFetchListsRequest {
	boardId: string;
}

export interface TrelloList {
	id: string;
	name: string;
	closed: boolean;
	idBoard: string;
	pos: number;
	subscribed: boolean;
}

export interface TrelloFetchListsResponse {
	lists: TrelloList[];
}

export const TrelloFetchListsRequestType = new RequestType<
	TrelloFetchListsRequest,
	TrelloFetchListsResponse,
	void,
	void
>("codeStream/trello/lists");
