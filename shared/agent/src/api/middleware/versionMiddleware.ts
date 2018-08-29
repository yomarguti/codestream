"use strict";
import opn from "opn";
import { Disposable, MessageActionItem } from "vscode-languageserver";
import { Container } from "../../container";
import { CodeStreamApi, CodeStreamApiMiddleware, CodeStreamApiMiddlewareContext } from "../api";

// export interface VersionCompatibilityChangedEvent {
// 	compatibility: VersionCompatibility;
// 	version: string | undefined;
// }

export class VersionMiddlewareManager implements Disposable {
	// private _onDidChangeCompatibility = new Emitter<VersionCompatibilityChangedEvent>();
	// get onDidChangeCompatibility(): Event<VersionCompatibilityChangedEvent> {
	// 	return this._onDidChangeCompatibility.event;
	// }

	private readonly _disposable: Disposable;
	private _compatibility: VersionCompatibility | undefined;

	constructor(private readonly _api: CodeStreamApi) {
		this._disposable = this._api.useMiddleware(new VersionMiddleware(this));
	}

	dispose() {
		this._disposable && this._disposable.dispose();
	}

	async notify(compatibility: VersionCompatibility, version: string | undefined) {
		if (this._compatibility === compatibility) return;

		this._compatibility = compatibility;
		// this._onDidChangeCompatibility.fire({ compatibility: compatibility, version: version });

		switch (compatibility) {
			case VersionCompatibility.CompatibleUpgradeAvailable: {
				const actions: MessageActionItem[] = [{ title: "Download" }, { title: "Later" }];
				const result = await Container.instance().session.showInformationMessage(
					"A new version of CodeStream is available.",
					...actions
				);
				if (result !== undefined && result.title === "Download") {
					this.downloadLatest();
				}
				break;
			}
			case VersionCompatibility.CompatibleUpgradeRecommended: {
				const actions: MessageActionItem[] = [{ title: "Download" }, { title: "Later" }];
				const result = await Container.instance().session.showWarningMessage(
					"A new version of CodeStream is available. We recommend upgrading as soon as possible.",
					...actions
				);
				if (result !== undefined && result.title === "Download") {
					this.downloadLatest();
				}
				break;
			}
			case VersionCompatibility.IncompatibleUpgradeRequired: {
				const actions: MessageActionItem[] = [{ title: "Download" }];
				const result = await Container.instance().session.showErrorMessage(
					"This version of CodeStream is no longer supported. Please download and install the latest version.",
					...actions
				);
				if (result !== undefined) {
					this.downloadLatest();
				}
				break;
			}
		}
	}

	async downloadLatest() {
		await opn("https://assets.codestream.com/prod/vscode/codestream-latest.vsix");
	}
}

enum VersionCompatibility {
	Compatible = "ok",
	CompatibleUpgradeAvailable = "outdated",
	CompatibleUpgradeRecommended = "deprecated",
	IncompatibleUpgradeRequired = "incompatible",
	Unknown = "unknownVersion"
}

export class VersionMiddleware implements CodeStreamApiMiddleware {
	constructor(private _manager: VersionMiddlewareManager) {}

	get name() {
		return "Version";
	}

	async onResponse<R>(context: Readonly<CodeStreamApiMiddlewareContext>, responseJson: Promise<R>) {
		if (context.response === undefined) return;
		if (!context.url.endsWith("/presence")) return;

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

		const version = context.response.headers.get("X-CS-Current-Version");
		void this._manager.notify(compatibility, version == null ? undefined : version);
	}
}
