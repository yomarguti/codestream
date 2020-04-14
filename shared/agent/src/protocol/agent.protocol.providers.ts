"use strict";
import { RequestType } from "vscode-languageserver-protocol";
import { CrossPostIssueValues } from "./agent.protocol";
import { CodemarkPlus } from "./agent.protocol.codemarks";
import { ReviewPlus } from "./agent.protocol.reviews";
import { CSMarkerLocations } from "./api.protocol";

export interface ThirdPartyProviderConfig {
	id: string;
	name: string;
	host: string;
	apiHost?: string;
	isEnterprise?: boolean;
	forEnterprise?: boolean;
	hasIssues?: boolean;
	hasSharing?: boolean;
	needsConfigure?: boolean;
	oauthData?: { [key: string]: any };
	scopes?: string[];
}

export interface ThirdPartyDisconnect {
	providerTeamId?: string;
}

export interface ThirdPartyProviders {
	[providerId: string]: ThirdPartyProviderConfig;
}

export interface ConnectThirdPartyProviderRequest {
	providerId: string;
}

export interface ConnectThirdPartyProviderResponse {}

export const ConnectThirdPartyProviderRequestType = new RequestType<
	ConnectThirdPartyProviderRequest,
	ConnectThirdPartyProviderResponse,
	void,
	void
>("codestream/provider/connect");

export interface ConfigureThirdPartyProviderRequest {
	providerId: string;
	data: { [key: string]: any };
}

export interface ConfigureThirdPartyProviderResponse {}

export const ConfigureThirdPartyProviderRequestType = new RequestType<
	ConfigureThirdPartyProviderRequest,
	ConfigureThirdPartyProviderResponse,
	void,
	void
>("codestream/provider/configure");

export interface AddEnterpriseProviderRequest {
	providerId: string;
	host: string;
	data: { [key: string]: any };
}

export interface AddEnterpriseProviderResponse {
	providerId: string;
}

export const AddEnterpriseProviderRequestType = new RequestType<
	AddEnterpriseProviderRequest,
	AddEnterpriseProviderResponse,
	void,
	void
>("codestream/provider/add");

export interface DisconnectThirdPartyProviderRequest {
	providerId: string;
	providerTeamId?: string;
}

export interface DisconnectThirdPartyProviderResponse {}

export const DisconnectThirdPartyProviderRequestType = new RequestType<
	DisconnectThirdPartyProviderRequest,
	DisconnectThirdPartyProviderResponse,
	void,
	void
>("codestream/provider/disconnect");

export interface ThirdPartyProviderBoard {
	id: string;
	name: string;
	apiIdentifier?: string;
	assigneesRequired?: boolean;
	assigneesDisabled?: boolean;
	singleAssignee?: boolean;
	[key: string]: any;
}

export interface FetchThirdPartyBoardsRequest {
	providerId: string;
	[key: string]: any;
}

export interface FetchThirdPartyBoardsResponse {
	boards: ThirdPartyProviderBoard[];
}

export const FetchThirdPartyBoardsRequestType = new RequestType<
	FetchThirdPartyBoardsRequest,
	FetchThirdPartyBoardsResponse,
	void,
	void
>("codestream/provider/boards");

export interface ThirdPartyProviderCard {
	id: string;
	name: string;
	apiIdentifier?: string;
	[key: string]: any;
}

export interface FetchThirdPartyCardsRequest {
	providerId: string;
	[key: string]: any;
}

export interface FetchThirdPartyCardsResponse {
	cards: ThirdPartyProviderCard[];
}

export const FetchThirdPartyCardsRequestType = new RequestType<
	FetchThirdPartyCardsRequest,
	FetchThirdPartyCardsResponse,
	void,
	void
>("codestream/provider/cards");

export interface CreateThirdPartyPostRequest {
	providerId: string;
	providerTeamId: string;
	channelId: string;
	text: string;
	attributes?: any;
	memberIds?: any;
	codemark?: CodemarkPlus;
	review?: ReviewPlus;
	remotes?: string[];
	entryPoint?: string;
	crossPostIssueValues?: CrossPostIssueValues;
	mentionedUserIds?: string[];
}
export interface CreateThirdPartyPostResponse {
	post: any;
}

export const CreateThirdPartyPostRequestType = new RequestType<
	CreateThirdPartyPostRequest,
	CreateThirdPartyPostResponse,
	void,
	void
>("codestream/provider/posts/create");

export const FetchThirdPartyChannelsRequestType = new RequestType<
	FetchThirdPartyChannelsRequest,
	FetchThirdPartyChannelsResponse,
	void,
	void
>("codestream/provider/channels");

export interface FetchThirdPartyChannelsRequest {
	providerId: string;
	providerTeamId: string;
	[key: string]: any;
}

export interface ThirdPartyChannel {
	id: string;
	name: string;
	type: string;
}

export interface FetchThirdPartyChannelsResponse {
	channels: ThirdPartyChannel[];
}

export interface ThirdPartyProviderUser {
	id?: string;
	displayName: string;
	email?: string;
}

export interface FetchAssignableUsersRequest {
	providerId: string;
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
>("codestream/provider/cards/users");

export interface CreateThirdPartyCardRequest {
	providerId: string;
	data: {
		[key: string]: any;
	};
}

export interface CreateThirdPartyCardResponse {
	[key: string]: any;
}

export const CreateThirdPartyCardRequestType = new RequestType<
	CreateThirdPartyCardRequest,
	CreateThirdPartyCardResponse,
	void,
	void
>("codestream/provider/cards/create");

interface ThirdPartyProviderSetTokenData {
	host?: string;
	token: string;
	data?: { [key: string]: any };
}

export interface ThirdPartyProviderSetTokenRequestData extends ThirdPartyProviderSetTokenData {
	teamId: string;
}

export interface ThirdPartyProviderSetTokenRequest extends ThirdPartyProviderSetTokenData {
	providerId: string;
}

export interface AddEnterpriseProviderHostRequest {
	provider: string;
	teamId: string;
	host: string;
	data: { [key: string]: any };
}

export interface AddEnterpriseProviderHostResponse {
	providerId: string;
}
