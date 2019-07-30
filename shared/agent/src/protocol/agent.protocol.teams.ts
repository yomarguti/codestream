"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import {
	CSCreateTeamRequest,
	CSCreateTeamResponse,
	CSTeam,
	CSTeamTagRequest,
	CSTeamTagResponse
} from "./api.protocol";

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

export interface CreateTeamRequest extends CSCreateTeamRequest {}

export interface CreateTeamResponse extends CSCreateTeamResponse {}

export const CreateTeamRequestType = new RequestType<
	CreateTeamRequest,
	CreateTeamResponse,
	void,
	void
>("codestream/team/create");

export const CreateTeamTagRequestType = new RequestType<
	CSTeamTagRequest,
	CSTeamTagResponse,
	void,
	void
>("codestream/team/tag/create");

export const DeleteTeamTagRequestType = new RequestType<
	CSTeamTagRequest,
	CSTeamTagResponse,
	void,
	void
>("codestream/team/tag/deleete");

export const UpdateTeamTagRequestType = new RequestType<
	CSTeamTagRequest,
	CSTeamTagResponse,
	void,
	void
>("codestream/team/tag/update");
