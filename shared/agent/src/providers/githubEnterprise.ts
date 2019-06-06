"use strict";

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

}
