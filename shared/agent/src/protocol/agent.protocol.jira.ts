"use strict";
import { RequestType } from "vscode-languageserver-protocol";
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

export const JiraFetchBoardsRequestType = new RequestType<
	void,
	JiraFetchBoardsResponse,
	void,
	void
>("codeStream/jira/boards");

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

export const CreateJiraCardRequestType = new RequestType<
	CreateJiraCardRequest,
	CreateJiraCardResponse,
	void,
	void
>("codeStream/jira/cards/create");
