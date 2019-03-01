"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import { CSTeam } from "./api.protocol";

export interface FetchTeamsRequest {
	mine?: boolean;
	teamIds?: string[];
}

export interface FetchTeamsResponse {
	teams: CSTeam[];
}

export const FetchTeamsRequestType = new RequestType<
	FetchTeamsRequest,
	FetchTeamsResponse,
	void,
	void
>("codestream/teams");

export interface GetTeamRequest {
	teamId: string;
}

export interface GetTeamResponse {
	team: CSTeam;
}

export const GetTeamRequestType = new RequestType<GetTeamRequest, GetTeamResponse, void, void>(
	"codestream/team"
);
