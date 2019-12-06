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
			"https://github.com/TeamCodeStream/CodeStream/wiki/Configuring-the-GitHub-Enterprise-Integration"
	},
	gitlab: { displayName: "GitLab", icon: "gitlab" },
	gitlab_enterprise: {
		displayName: "GitLab Self-Managed",
		shortDisplayName: "GitLab",
		icon: "gitlab",
		urlPlaceholder: "https://gitlab.myorg.com",
		helpUrl:
			"https://github.com/TeamCodeStream/CodeStream/wiki/Configuring-the-GitLab-Self-Managed-Integration"
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
};

