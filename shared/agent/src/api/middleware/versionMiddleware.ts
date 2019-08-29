"use strict";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import { ApiVersionCompatibility, VersionCompatibility } from "../../protocol/agent.protocol";
import { CSApiCapability, CSApiCapabilities } from "../../protocol/api.protocol.models";
import { log } from "../../system";
import {
	ApiProvider,
	CodeStreamApiMiddleware,
	CodeStreamApiMiddlewareContext
} from "../apiProvider";
import { APIServerVersionInfo } from "../codestream/apiServerVersionInfo";
import { SessionContainer } from "../../container";

export interface VersionCompatibilityChangedEvent {
	compatibility: VersionCompatibility;
	downloadUrl: string;
	version: string | undefined;
}

export interface ApiVersionCompatibilityChangedEvent {
	compatibility: ApiVersionCompatibility;
	version: string;
	missingCapabilities?: CSApiCapabilities;
}

export class VersionMiddlewareManager implements Disposable {
	private _onDidChangeCompatibility = new Emitter<VersionCompatibilityChangedEvent>();
	get onDidChangeCompatibility(): Event<VersionCompatibilityChangedEvent> {
		return this._onDidChangeCompatibility.event;
	}

	private _onDidChangeApiCompatibility = new Emitter<ApiVersionCompatibilityChangedEvent>();
	get onDidChangeApiCompatibility(): Event<ApiVersionCompatibilityChangedEvent> {
		return this._onDidChangeApiCompatibility.event;
	}

	private readonly _disposable: Disposable;
	private _compatibility: VersionCompatibility | undefined;
	private _apiVersion: string = "";

	constructor(private readonly _api: ApiProvider) {
		this._disposable = this._api.useMiddleware(new VersionMiddleware(this));
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	@log()
	async notify(compatibility: VersionCompatibility, url: string, version: string | undefined) {
		if (this._compatibility === compatibility) return;

		this._compatibility = compatibility;
		this._onDidChangeCompatibility.fire({
			compatibility: compatibility,
			downloadUrl: url,
			version: version
		});
	}

	@log()
	async apiVersionNotify(
		compatibility: ApiVersionCompatibility,
		version: string,
		missingCapabilities: CSApiCapabilities
	) {
		this._onDidChangeApiCompatibility.fire({
			compatibility,
			version,
			missingCapabilities
		});
	}

	@log()
	async setApiVersion(version: string) {
		const prevApiVersion = this._apiVersion;
		let compatibility = ApiVersionCompatibility.ApiCompatible;
		let missingCapabilities = {};
		if (version !== prevApiVersion) {
			if (this.compareVersions(version, APIServerVersionInfo.minimumRequired) === -1) {
				compatibility = ApiVersionCompatibility.ApiUpgradeRequired;
			}
			else if (this.compareVersions(version, APIServerVersionInfo.minimumPreferred) === -1) {
				compatibility = ApiVersionCompatibility.ApiUpgradeRecommended;
			}

			const preferredCapabilities: { [id: string]: CSApiCapability } = APIServerVersionInfo.preferredCapabilities;
			missingCapabilities = Object.keys(preferredCapabilities).reduce((capabilities, id) => {
				const capability = preferredCapabilities[id];
				if (capability.version && this.compareVersions(version, capability.version) < 0) {
					(capabilities as CSApiCapabilities)[id] = capability;
				}
				return capabilities;
			}, {}) as CSApiCapabilities;

			this.apiVersionNotify(compatibility, version, missingCapabilities);
			if (compatibility !== ApiVersionCompatibility.ApiUpgradeRequired) {
				if (SessionContainer.isInitialized()) {
					await SessionContainer.instance().session.didChangeCodeStreamApiVersion();
					this._apiVersion = version;
				}
			}
		}
	}

	get apiVersion() {
		return this._apiVersion;
	}

	compareVersions(version1: string, version2: string) {
		const [ major1, minor1, patch1 ] = version1.split(".").map(str => parseInt(str, 10));
		const [ major2, minor2, patch2 ] = version2.split(".").map(str => parseInt(str, 10));
		if (major1 > major2) return 1;
		else if (major1 < major2) return -1;
		else if (minor1 > minor2) return 1;
		else if (minor1 < minor2) return -1;
		else if (patch1 > patch2) return 1;
		else if (patch1 < patch2) return -1;
		else return 0;
	}
}

export class VersionMiddleware implements CodeStreamApiMiddleware {
	constructor(private _manager: VersionMiddlewareManager) {}

	get name() {
		return "Version";
	}

	async onResponse<R>(context: Readonly<CodeStreamApiMiddlewareContext>, responseJson: Promise<R>) {
		if (context.response === undefined) return;

		const apiVersion = context.response.headers.get("X-CS-API-Version") || "";
		this._manager.setApiVersion(apiVersion);

		const compatibility = context.response.headers.get(
			"X-CS-Version-Disposition"
		) as VersionCompatibility | null;

		if (
			compatibility == null ||
			compatibility === VersionCompatibility.Compatible ||
			compatibility === VersionCompatibility.Unknown
		) {
			return;
		}

		if (
			(!context.response.ok && compatibility === VersionCompatibility.UnsupportedUpgradeRequired) ||
			(context.response.ok &&
				compatibility === VersionCompatibility.CompatibleUpgradeRecommended &&
				(!context.url.endsWith("/login") && context.url.indexOf("no-auth") === -1))
		) {
			// url checks are for trying not to fire this during the auth process
			const url =
				context.response.headers.get("X-CS-Latest-Asset-Url") || "https://www.codestream.com/";
			const version = context.response.headers.get("X-CS-Current-Version");
			void this._manager.notify(compatibility, url, version == null ? undefined : version);
		}
	}
}
