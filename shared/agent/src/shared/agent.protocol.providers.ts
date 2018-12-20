"use strict";
import { RequestType } from "vscode-languageserver-protocol";

export interface ConnectThirdParyProviderRequest {
	providerName: string;
}

export interface ConnectThirdParyProviderResponse {
	code: string;
}

export const ConnectThirdParyProviderRequestType = new RequestType<
	ConnectThirdParyProviderRequest,
	ConnectThirdParyProviderResponse,
	void,
	void
>("codeStream/provider/connect");

export interface DisconnectThirdParyProviderRequest {
	providerName: string;
}

export interface DisconnectThirdParyProviderResponse {}

export const DisconnectThirdParyProviderRequestType = new RequestType<
	DisconnectThirdParyProviderRequest,
	DisconnectThirdParyProviderResponse,
	void,
	void
>("codeStream/provider/disconnect");
