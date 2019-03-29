"use strict";
import { ThirdPartyProviderBoard } from "./agent.protocol";

export interface JiraUser {
	accountId: string;
	name: string;
	displayName: string;
	emailAddress: string;
}

export interface JiraBoard extends ThirdPartyProviderBoard {
	issueTypes: string[];
}

export interface JiraFetchBoardsResponse {
	boards: JiraBoard[];
}

export interface CreateJiraCardRequest {
	summary: string;
	description: string;
	project: string;
	issueType: string;
	assignees: [{ name: string }];
}

export interface CreateJiraCardResponse {
	id: string;
	url: string;
}
