export interface ProviderDisplay {
	displayName: string;
	icon?: string;
	getUrl?: string;
	urlPlaceholder?: string;
	helpUrl?: string;
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
		displayName: "GitLab Enterprise",
		icon: "gitlab",
		urlPlaceholder: "https://gitlab.myorg.com",
		helpUrl:
			"https://github.com/TeamCodeStream/CodeStream/wiki/Configuring-the-GitLab-Enterprise-Integration"
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
	slack: { displayName: "Slack", icon: "slack" },
	msteams: { displayName: "Microsoft Teams", icon: "msteams" }
};

export enum CodeDelimiterStyles {
	NONE = "none",
	TRIPLE_BACK_QUOTE = "tripleBackQuote",
	SINGLE_BACK_QUOTE = "singleBackQuote",
	HTML_MARKUP = "htmlMarkup",
	CODE_BRACE = "codeBrace"
}
