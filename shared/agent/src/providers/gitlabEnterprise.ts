"use strict";

import { lspProvider } from "../system";
import { GitLabProvider } from "./gitlab";

@lspProvider("gitlab_enterprise")
export class GitLabEnterpriseProvider extends GitLabProvider {
	get displayName() {
		return "GitLab Enterprise";
	}

	get name() {
		return "gitlab_enterprise";
	}

	get apiPath() {
		return this.providerConfig.isEnterprise ? "/api/v4" : "";
	}
}
