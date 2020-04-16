"use strict";

import { GitRemote } from "git/gitService";
import { URI } from "vscode-uri";
import { EnterpriseConfigurationData } from "../protocol/agent.protocol.providers";
import { log, lspProvider } from "../system";
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
		return this.providerConfig.forEnterprise || this.providerConfig.isEnterprise ? "/api/v3" : "";
	}

	get baseUrl() {
		const { host, apiHost, isEnterprise, forEnterprise } = this.providerConfig;
		let returnHost;
		if (isEnterprise) {
			returnHost = host;
		} else if (forEnterprise) {
			returnHost = this._providerInfo?.data?.baseUrl || host;
		} else {
			returnHost = `https://${apiHost}`;
		}
		return `${returnHost}${this.apiPath}`;
	}

	protected getIsMatchingRemotePredicate() {
		const baseUrl = this._providerInfo?.data?.baseUrl || this.getConfig().host;
		const configDomain = baseUrl ? URI.parse(baseUrl).authority : "";
		return (r: GitRemote) => configDomain !== "" && r.domain === configDomain;
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

	@log()
	async configure(request: EnterpriseConfigurationData) {
		await this.session.api.setThirdPartyProviderToken({
			providerId: this.providerConfig.id,
			host: request.host,
			token: request.token,
			data: {
				baseUrl: request.baseUrl
			}
		});
		this.session.updateProviders();
	}
}
