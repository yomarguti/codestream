"use strict";
import { Disposable, Emitter, Event } from "vscode-languageserver";
import { VersionCompatibility } from "../../protocol/agent.protocol";
import { log } from "../../system";
import {
	ApiProvider,
	CodeStreamApiMiddleware,
	CodeStreamApiMiddlewareContext
} from "../apiProvider";

export interface VersionCompatibilityChangedEvent {
	compatibility: VersionCompatibility;
	downloadUrl: string;
	version: string | undefined;
}

export class VersionMiddlewareManager implements Disposable {
	private _onDidChangeCompatibility = new Emitter<VersionCompatibilityChangedEvent>();
	get onDidChangeCompatibility(): Event<VersionCompatibilityChangedEvent> {
		return this._onDidChangeCompatibility.event;
	}

	private readonly _disposable: Disposable;
	private _compatibility: VersionCompatibility | undefined;

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
}

export class VersionMiddleware implements CodeStreamApiMiddleware {
	constructor(private _manager: VersionMiddlewareManager) {}

	get name() {
		return "Version";
	}

	async onResponse<R>(context: Readonly<CodeStreamApiMiddlewareContext>, responseJson: Promise<R>) {
		if (context.response === undefined) return;

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
