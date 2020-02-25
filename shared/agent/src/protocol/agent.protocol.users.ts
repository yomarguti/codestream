"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import { RepoScmStatus, Unreads } from "./agent.protocol";
import { CSMe, CSMePreferences, CSMeStatus, CSPresenceStatus, CSUser } from "./api.protocol";

export interface FetchUsersRequest {
	userIds?: string[];
}

export interface FetchUsersResponse {
	users: CSUser[];
}

export const FetchUsersRequestType = new RequestType<
	FetchUsersRequest,
	FetchUsersResponse,
	void,
	void
>("codestream/users");

export interface GetUserRequest {
	userId: string;
}

export interface GetUserResponse {
	user: CSUser;
}

export const GetUserRequestType = new RequestType<GetUserRequest, GetUserResponse, void, void>(
	"codestream/user"
);

export interface InviteUserRequest {
	email: string;
	fullName?: string;
}

export interface InviteUserResponse {
	user: CSUser;
}

export const InviteUserRequestType = new RequestType<
	InviteUserRequest,
	InviteUserResponse,
	void,
	void
>("codestream/user/invite");

export interface UpdateUserRequest {
	username?: string;
	fullName?: string;
	timeZone?: string;
}

export interface UpdateUserResponse {
	user: CSUser;
}

export const UpdateUserRequestType = new RequestType<
	UpdateUserRequest,
	UpdateUserResponse,
	void,
	void
>("codestream/user/update");

export interface UpdatePresenceRequest {
	sessionId: string;
	status: CSPresenceStatus;
}

export interface UpdatePresenceResponse {
	awayTimeout: number;
}

export const UpdatePresenceRequestType = new RequestType<
	UpdatePresenceRequest,
	UpdatePresenceResponse,
	void,
	void
>("codestream/user/updatePresence");

export interface UpdatePreferencesRequest {
	preferences: CSMePreferences;
}

export interface UpdatePreferencesResponse {
	preferences: CSMePreferences;
}

export const UpdatePreferencesRequestType = new RequestType<
	UpdatePreferencesRequest,
	UpdatePreferencesResponse,
	void,
	void
>("codestream/user/updatePreferences");

export interface UpdateStatusRequest {
	status: CSMeStatus;
}

export interface UpdateStatusResponse {
	user: CSUser;
}

export const UpdateStatusRequestType = new RequestType<
	UpdateStatusRequest,
	UpdateStatusResponse,
	void,
	void
>("codestream/user/updateStatus");

export interface SetModifiedReposRequest {
	modifiedRepos: { [teamId: string]: RepoScmStatus[] };
}

export interface SetModifiedReposResponse {
	user: CSUser;
}

export const SetModifiedReposRequestType = new RequestType<
	SetModifiedReposRequest,
	SetModifiedReposResponse,
	void,
	void
>("codestream/user/setModifiedRepos");

export interface GetMeRequest {}

export interface GetMeResponse {
	user: CSMe;
}

export const GetMeRequestType = new RequestType<GetMeRequest, GetMeResponse, void, void>(
	"codestream/users/me"
);

export interface GetUnreadsRequest {}

export interface GetUnreadsResponse {
	unreads: Unreads;
}

export const GetUnreadsRequestType = new RequestType<
	GetUnreadsRequest,
	GetUnreadsResponse,
	void,
	void
>("codestream/users/me/unreads");

export interface GetPreferencesResponse {
	preferences: CSMePreferences;
}

export const GetPreferencesRequestType = new RequestType<void, GetPreferencesResponse, void, void>(
	"codestream/users/me/preferences"
);
