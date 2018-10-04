"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import { CSMe, CSMePreferences, CSPresenceStatus, CSUser } from "./api.protocol";

export interface FetchUsersRequest {}

export interface FetchUsersResponse {
	users: CSUser[];
}

export const FetchUsersRequestType = new RequestType<
	FetchUsersRequest,
	FetchUsersResponse,
	void,
	void
>("codeStream/users");

export interface GetUserRequest {
	userId: string;
}

export interface GetUserResponse {
	user: CSUser;
}

export const GetUserRequestType = new RequestType<GetUserRequest, GetUserResponse, void, void>(
	"codeStream/user"
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
>("codeStream/user/invite");

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
>("codeStream/user/updatePresence");

export interface UpdatePreferencesRequest {
	preferences: CSMePreferences;
}

export interface UpdatePreferencesResponse {}

export const UpdatePreferencesRequestType = new RequestType<
	UpdatePreferencesRequest,
	UpdatePreferencesResponse,
	void,
	void
>("codeStream/user/updatePreferences");

export interface GetMeRequest {}

export interface GetMeResponse {
	user: CSMe;
}

export const GetMeRequestType = new RequestType<GetMeRequest, GetMeResponse, void, void>(
	"codeStream/users/me"
);
