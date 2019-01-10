"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface AsanaCreateCardRequest {
	name: string;
	description: string;
	boardId: number;
	listId: number;
}

export interface AsanaCreateCardResponse {
	id: string;
}

export const AsanaCreateCardRequestType = new RequestType<
	AsanaCreateCardRequest,
	AsanaCreateCardResponse,
	void,
	void
>("codeStream/asana/cards/create");

export interface AsanaFetchBoardsRequest {
	organizationId?: string;
}

export interface AsanaBoard {
	id: number;
	gid: string;
	name: string;
	// desc: string;
	// descData: string;
	// closed: boolean;
	// idOrganization: string;
	// pinned: boolean;
	// url: string;
	// labelNames: { [color: string]: string };
	// starred: boolean;
	lists: AsanaList[];
}

export interface AsanaFetchBoardsResponse {
	boards: AsanaBoard[];
}

export const AsanaFetchBoardsRequestType = new RequestType<
	AsanaFetchBoardsRequest,
	AsanaFetchBoardsResponse,
	void,
	void
>("codeStream/asana/boards");

export interface AsanaFetchListsRequest {
	boardId: string;
}

export interface AsanaList {
	id: number;
	gid: string;
	name: string;
	// closed: boolean;
	// idBoard: string;
	// pos: number;
	// subscribed: boolean;
}

export interface AsanaFetchListsResponse {
	lists: AsanaList[];
}

export const AsanaFetchListsRequestType = new RequestType<
	AsanaFetchListsRequest,
	AsanaFetchListsResponse,
	void,
	void
>("codeStream/asana/lists");
