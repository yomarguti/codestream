export interface ProviderDisplay {
	displayName: string;
	shortDisplayName?: string;
	icon?: string;
	getUrl?: string;
	urlPlaceholder?: string;
	helpUrl?: string;
	groupName?: string;
}

export const PROVIDER_MAPPINGS: { [provider: string]: ProviderDisplay } = {
	asana: { displayName: "Asana", icon: "asana" },
	bitbucket: { displayName: "Bitbucket", icon: "bitbucket" },
	github: { displayName: "GitHub", icon: "mark-github" },
	github_enterprise: {
		displayName: "GitHub Enterprise",
		icon: "mark-github",
		urlPlaceholder: "https://git.myorg.com",
		helpUrl:
			"https://help.github.com/en/enterprise/2.15/user/articles/creating-a-personal-access-token-for-the-command-line"
	},
	gitlab: { displayName: "GitLab", icon: "gitlab" },
	gitlab_enterprise: {
		displayName: "GitLab Self-Managed",
		shortDisplayName: "GitLab",
		icon: "gitlab",
		urlPlaceholder: "https://gitlab.myorg.com",
		helpUrl: "https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html"
	},
	jira: { displayName: "Jira", icon: "jira" },
	jiraserver: {
		displayName: "Jira Server",
		icon: "jira",
		urlPlaceholder: "https://jira.myorg.com"
	},
	trello: { displayName: "Trello", icon: "trello" },
	youtrack: {
		displayName: "YouTrack",
		icon: "youtrack",
		getUrl: "https://www.jetbrains.com/youtrack/download/get_youtrack.html"
	},
	azuredevops: {
		displayName: "Azure DevOps",
		icon: "azuredevops",
		getUrl: "https://azure.microsoft.com/en-us/services/devops"
	},
	slack: { displayName: "Slack", icon: "slack", groupName: "Workspace" },
	msteams: { displayName: "Microsoft Teams", icon: "msteams", groupName: "Organization" }
	//okta: { displayName: "Okta", icon: "okta" } -- suppress display under "Active Integrations"
};
