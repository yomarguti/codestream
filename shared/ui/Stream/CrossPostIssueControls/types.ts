export interface ProviderDisplay {
	displayName: string;
	shortDisplayName?: string;
	icon: string;
	getUrl?: string;
	urlPlaceholder?: string;
	helpUrl?: string;
	groupName?: string;
	boardLabel?: string;
	listLabel?: string;
	cardLabel?: string;
	boardLabelCaps?: string; // added programatically
	listLabelCaps?: string; // added programatically
	cardLabelCaps?: string; // added programatically

	// FIXME -- temp this should come from the server
	supportsStartWork?: boolean;
	hasFilters?: boolean;
}

export const PROVIDER_MAPPINGS: { [provider: string]: ProviderDisplay } = {
	asana: {
		displayName: "Asana",
		icon: "asana",
		boardLabel: "project",
		listLabel: "section",
		cardLabel: "task",
		supportsStartWork: true
	},
	bitbucket: {
		displayName: "Bitbucket",
		icon: "bitbucket",
		boardLabel: "project",
		listLabel: "list",
		cardLabel: "issue",
		supportsStartWork: true
	},
	github: {
		displayName: "GitHub",
		icon: "mark-github",
		boardLabel: "repo",
		listLabel: "type",
		cardLabel: "issue",
		supportsStartWork: true
	},
	github_enterprise: {
		displayName: "GitHub Enterprise",
		icon: "mark-github",
		urlPlaceholder: "https://git.myorg.com",
		helpUrl:
			"https://help.github.com/en/enterprise/2.15/user/articles/creating-a-personal-access-token-for-the-command-line",
		boardLabel: "repo",
		listLabel: "type",
		cardLabel: "issue",
		supportsStartWork: true
	},
	gitlab: {
		displayName: "GitLab",
		icon: "gitlab",
		boardLabel: "repo",
		listLabel: "type",
		cardLabel: "issue",
		supportsStartWork: true
	},
	gitlab_enterprise: {
		displayName: "GitLab Self-Managed",
		shortDisplayName: "GitLab",
		icon: "gitlab",
		urlPlaceholder: "https://gitlab.myorg.com",
		helpUrl: "https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html",
		boardLabel: "repo",
		listLabel: "type",
		cardLabel: "issue",
		supportsStartWork: true
	},
	jira: {
		displayName: "Jira",
		icon: "jira",
		boardLabel: "project",
		listLabel: "type",
		cardLabel: "ticket",
		supportsStartWork: true
	},
	jiraserver: {
		displayName: "Jira Server",
		icon: "jira",
		urlPlaceholder: "https://jira.myorg.com",
		boardLabel: "project",
		listLabel: "type",
		cardLabel: "ticket"
	},
	trello: {
		displayName: "Trello",
		icon: "trello",
		boardLabel: "board",
		listLabel: "list",
		cardLabel: "card",
		hasFilters: true,
		supportsStartWork: true
	},
	youtrack: {
		displayName: "YouTrack",
		icon: "youtrack",
		getUrl: "https://www.jetbrains.com/youtrack/download/get_youtrack.html",
		boardLabel: "project",
		listLabel: "type",
		cardLabel: "issue",
		supportsStartWork: true
	},
	azuredevops: {
		displayName: "Azure DevOps",
		icon: "azuredevops",
		getUrl: "https://azure.microsoft.com/en-us/services/devops",
		boardLabel: "project",
		listLabel: "list",
		cardLabel: "work item",
		supportsStartWork: true
	},
	slack: { displayName: "Slack", icon: "slack", groupName: "Workspace" },
	msteams: { displayName: "Microsoft Teams", icon: "msteams", groupName: "Organization" }
	//okta: { displayName: "Okta", icon: "okta" } -- suppress display under "Active Integrations"
};

const ucFirst = (string = "") => string.charAt(0).toUpperCase() + string.slice(1);

Object.keys(PROVIDER_MAPPINGS).forEach(key => {
	PROVIDER_MAPPINGS[key].boardLabelCaps = ucFirst(PROVIDER_MAPPINGS[key].boardLabel);
	PROVIDER_MAPPINGS[key].listLabelCaps = ucFirst(PROVIDER_MAPPINGS[key].listLabel);
	PROVIDER_MAPPINGS[key].cardLabelCaps = ucFirst(PROVIDER_MAPPINGS[key].cardLabel);
});
