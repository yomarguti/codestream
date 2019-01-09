"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface ConnectThirdPartyProviderRequest {
	providerName: string;
}

export interface ConnectThirdPartyProviderResponse {
	code: string;
}

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

export const DisconnectThirdParyProviderRequestType = new RequestType<
	DisconnectThirdPartyProviderRequest,
	DisconnectThirdPartyProviderResponse,
	void,
	void
>("codeStream/provider/disconnect");
