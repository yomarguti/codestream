"use strict";

export interface GitLabCreateCardRequest {
	repoName: string;
	title: string;
	description: string;
	assignee: { id: string };
}

export interface GitLabCreateCardResponse {
	id: string;
	web_url: string;
}

export interface GitLabFetchBoardsRequest {
	organizationId?: string;
}

export interface GitLabBoard {
	id: string;
	name: string;
}

export interface GitLabFetchBoardsResponse {
	boards: GitLabBoard[];
}

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
