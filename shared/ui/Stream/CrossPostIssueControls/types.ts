import { ThirdPartyProviderConfig, ThirdPartyProviderBoard } from "@codestream/protocols/agent";

export interface CardValues {
	isEnabled: boolean;
	issueProvider: ThirdPartyProviderConfig;
	board?: ThirdPartyProviderBoard;
	[key: string]: any;
}
export type CrossPostIssueValuesListener = (values: CardValues) => any;

export interface ProviderDisplay {
	displayName: string;
	icon?: string;
	getUrl?: string;
	urlPlaceholder?: string;
}

export const PROVIDER_MAPPINGS: { [provider: string]: ProviderDisplay } = {
	asana: { displayName: "Asana", icon: "asana" },
	bitbucket: { displayName: "Bitbucket", icon: "bitbucket" },
	github: { displayName: "GitHub", icon: "mark-github" },
	github_enterprise: {
		displayName: "GitHub Enterprise",
		icon: "mark-github",
		urlPlaceholder: "https://git.myorg.com"
	},
	gitlab: { displayName: "GitLab", icon: "gitlab" },
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
	TRIPLE_BACK_QUOTE = "tripleBackQuote",
	SINGLE_BACK_QUOTE = "singleBackQuote",
	HTML_MARKUP = "htmlMarkup",
	CODE_BRACE = "codeBrace"
};
