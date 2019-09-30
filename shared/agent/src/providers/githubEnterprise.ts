"use strict";

import { GitRemote } from "git/gitService";
import { URI } from "vscode-uri";
import { lspProvider } from "../system";
import { GitHubProvider } from "./github";

@lspProvider("github_enterprise")
export class GitHubEnterpriseProvider extends GitHubProvider {
	get displayName() {
		return "GitHub Enterprise";
	}

	get name() {
		return "github_enterprise";
	}

	get apiPath() {
		return this.providerConfig.isEnterprise ? "/api/v3" : "";
	}

	protected getIsMatchingRemotePredicate() {
		const configDomain = URI.parse(this.getConfig().host).authority;
		return (r: GitRemote) => r.domain === configDomain;
	}

	private _isPRApiCompatible: boolean | undefined;
	protected async isPRApiCompatible(): Promise<boolean> {
		if (this._isPRApiCompatible == null) {
			const response = await this.get<{ installed_version: string }>("/meta");

			const [major, minor] = response.body.installed_version.split(".").map(Number);
			this._isPRApiCompatible = major > 2 || (major === 2 && minor >= 15);
		}

		return this._isPRApiCompatible;
	}
}
