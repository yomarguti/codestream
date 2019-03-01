"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface AsanaCreateCardRequest {
	name: string;
	description: string;
	boardId: number;
	listId: number;
	assignee: { id: string };
}

export interface AsanaWorkspace {
	id: number;
	gid: string;
}

export interface AsanaProject {
	id: number;
	gid: string;
	layout: string;
	name: string;
	sections: AsanaSection[];
	workspace: AsanaWorkspace;
}

export interface AsanaSection {
	id: number;
	gid: string;
	name: string;
}

export interface AsanaUser {
	id: number;
	gid: string;
	name: string;
	email: string;
	workspaces: AsanaWorkspace[];
}

export interface AsanaCreateCardResponse {
	data: {
		gid: string;
		url: string;
		projects: AsanaProject[];
		[key: string]: any;
	};
}

export const AsanaCreateCardRequestType = new RequestType<
	AsanaCreateCardRequest,
	AsanaCreateCardResponse,
	void,
	void
>("codestream/asana/cards/create");

export interface AsanaFetchBoardsRequest {
	organizationId?: string;
}

export interface AsanaBoard {
	id: number;
	name: string;
	lists: AsanaList[];
	singleAssignee?: boolean;
}

export interface AsanaFetchBoardsResponse {
	boards: AsanaBoard[];
}

export const AsanaFetchBoardsRequestType = new RequestType<
	AsanaFetchBoardsRequest,
	AsanaFetchBoardsResponse,
	void,
	void
>("codestream/asana/boards");

export interface AsanaFetchListsRequest {
	boardId: string;
}

export interface AsanaList {
	id: number;
	name: string;
}

export interface AsanaFetchListsResponse {
	lists: AsanaList[];
}

export const AsanaFetchListsRequestType = new RequestType<
	AsanaFetchListsRequest,
	AsanaFetchListsResponse,
	void,
	void
>("codestream/asana/lists");
