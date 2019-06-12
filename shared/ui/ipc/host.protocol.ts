import {
	Capabilities,
	CodeStreamEnvironment,
	ThirdPartyProviders,
	Unreads
} from "@codestream/protocols/agent";
import {
	CSMarker,
	CSMePreferences,
	CSRepository,
	CSStream,
	CSTeam,
	CSUser
} from "@codestream/protocols/api";
import { RequestType } from "vscode-jsonrpc";
import { EditorContext, IpcRoutes, WebviewContext } from "./webview.protocol.common";

export interface BootstrapRequest {}
export interface SignedOutBootstrapResponse {
	capabilities: Capabilities;
	configs: {
		[key: string]: any;
	};
	version: string;
	context: Partial<WebviewContext>;
	env?: CodeStreamEnvironment | string;
	loginToken?: string;
}
export interface SignedInBootstrapResponse extends SignedOutBootstrapResponse {
	editorContext: EditorContext;
	session: {
		userId: string;
	};

	preferences: CSMePreferences;
	repos: CSRepository[];
	streams: CSStream[];
	teams: CSTeam[];
	users: CSUser[];
	unreads: Unreads;
	providers: ThirdPartyProviders;
}
export type BootstrapResponse = SignedInBootstrapResponse | SignedOutBootstrapResponse;
export const BootstrapRequestType = new RequestType<
	BootstrapRequest,
	BootstrapResponse,
	void,
	void
>(`${IpcRoutes.Host}/bootstrap`);

export function isSignedInBootstrap(data: BootstrapResponse): data is SignedInBootstrapResponse {
	return (data as any).session != null;
}

export interface LoginRequest {
	email: string;
	password: string;
}
export interface LoginResponse extends SignedInBootstrapResponse {}
export const LoginRequestType = new RequestType<LoginRequest, LoginResponse, void, void>(
	`${IpcRoutes.Host}/login`
);

export interface LogoutRequest {}
export interface LogoutResponse {}
export const LogoutRequestType = new RequestType<LogoutRequest, LogoutResponse, void, void>(
	`${IpcRoutes.Host}/logout`
);

export interface LoginSSORequest {
	provider: string;
	queryString?: string;
}
export interface LoginSSOResponse {}
export const LoginSSORequestType = new RequestType<LoginSSORequest, LoginSSOResponse, void, void>(
	`${IpcRoutes.Host}/login/sso`
);

export interface ValidateThirdPartyAuthRequest {
	alias?: boolean;
}
export interface ValidateThirdPartyAuthResponse extends SignedInBootstrapResponse {}
export const ValidateThirdPartyAuthRequestType = new RequestType<
	ValidateThirdPartyAuthRequest,
	ValidateThirdPartyAuthResponse,
	void,
	void
>(`${IpcRoutes.Host}/validateThirdPartyAuth`);

export interface CompleteSignupRequest {
	email: string;
	teamId?: string;
	token: string;
}

export const CompleteSignupRequestType = new RequestType<
	CompleteSignupRequest,
	SignedInBootstrapResponse,
	void,
	void
>(`${IpcRoutes.Host}/signup/complete`);

export const ReloadWebviewRequestType = new RequestType<void, void, void, void>(
	`${IpcRoutes.Host}/webview/reload`
);

export interface CompareMarkerRequest {
	marker: CSMarker;
}
export interface CompareMarkerResponse {}

export const CompareMarkerRequestType = new RequestType<
	CompareMarkerRequest,
	CompareMarkerResponse,
	void,
	void
>(`${IpcRoutes.Host}/marker/compare`);

export interface ApplyMarkerRequest {
	marker: CSMarker;
}

export interface ApplyMarkerResponse {}

export const ApplyMarkerRequestType = new RequestType<
	ApplyMarkerRequest,
	ApplyMarkerResponse,
	void,
	void
>(`${IpcRoutes.Host}/marker/apply`);

export interface UpdateConfigurationRequest {
	name: string;
	value: any;
}

export interface UpdateConfigurationResponse {}

export const UpdateConfigurationRequestType = new RequestType<
	UpdateConfigurationRequest,
	UpdateConfigurationResponse,
	void,
	void
>(`${IpcRoutes.Host}/configuration/update`);
