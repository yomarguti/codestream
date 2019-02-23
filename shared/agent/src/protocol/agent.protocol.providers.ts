"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface ConnectThirdPartyProviderRequest {
	providerName: string;
}

export interface ConnectThirdPartyProviderResponse {}

export const ConnectThirdParyProviderRequestType = new RequestType<
	ConnectThirdPartyProviderRequest,
	ConnectThirdPartyProviderResponse,
	void,
	void
>("codeStream/provider/connect");

export interface DisconnectThirdPartyProviderRequest {
	providerName: string;
}

export interface DisconnectThirdPartyProviderResponse {}

export const DisconnectThirdPartyProviderRequestType = new RequestType<
	DisconnectThirdPartyProviderRequest,
	DisconnectThirdPartyProviderResponse,
	void,
	void
>("codeStream/provider/disconnect");

export interface FetchThirdPartyBoardsRequest {
	[key: string]: any;
}

export interface FetchAssignableUsersRequest {
	providerName: string;
	boardId: string;
}

export interface FetchAssignableUsersResponse {
	users: ThirdPartyProviderUser[];
}

export const FetchAssignableUsersRequestType = new RequestType<
	FetchAssignableUsersRequest,
	FetchAssignableUsersResponse,
	void,
	void
>("codeStream/provider/cards/users");

export interface ThirdPartyProviderBoard {
	id: string;
	name: string;
	assigneesRequired: boolean;
	assigneesDisabled?: boolean;
	singleAssignee?: boolean;
}

export interface ThirdPartyProviderUser {
	id: string;
	displayName: string;
	email?: string;
}
