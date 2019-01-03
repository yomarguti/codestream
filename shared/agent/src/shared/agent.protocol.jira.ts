"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface JiraBoard {
	id: string;
	name: string;
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
}

export interface CreateJiraCardResponse {
	id: string;
}

export const CreateJiraCardRequestType = new RequestType<
	CreateJiraCardRequest,
	CreateJiraCardResponse,
	void,
	void
>("codeStream/jira/cards/create");
