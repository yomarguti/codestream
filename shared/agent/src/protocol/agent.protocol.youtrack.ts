"use strict";

export interface YouTrackCreateCardRequest {
	listId: string;
	name: string;
	description: string;
	assignees?: [{ id: string }];
}

export interface YouTrackCreateCardResponse {
	id: string;
	url: string;
}

export interface YouTrackFetchBoardsRequest {
	organizationId?: string;
}

export interface YouTrackBoard {
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
	lists: YouTrackList[];
}

export interface YouTrackFetchBoardsResponse {
	boards: YouTrackBoard[];
}

export interface YouTrackFetchListsRequest {
	boardId: string;
}

export interface YouTrackList {
	id: string;
	name: string;
	closed: boolean;
	idBoard: string;
	pos: number;
	subscribed: boolean;
}

export interface YouTrackFetchListsResponse {
	lists: YouTrackList[];
}

export interface YouTrackMember {
	id: string;
	username: string;
	email: string;
	fullName: string;
}
