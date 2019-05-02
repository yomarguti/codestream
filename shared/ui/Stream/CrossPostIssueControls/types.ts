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
}

export const PROVIDER_MAPPINGS: { [provider: string]: ProviderDisplay } = {
	asana: { displayName: "Asana", icon: "asana" },
	bitbucket: { displayName: "Bitbucket", icon: "bitbucket" },
	github: { displayName: "GitHub", icon: "mark-github" },
	gitlab: { displayName: "GitLab", icon: "gitlab" },
	jira: { displayName: "Jira", icon: "jira" },
	trello: { displayName: "Trello", icon: "trello" },
	youtrack: {
		displayName: "YouTrack",
		icon: "youtrack",
		getUrl: "https://www.jetbrains.com/youtrack/download/get_youtrack.html"
	},
	azuredevops: { 
		displayName: "Azure DevOps",
		icon: "azuredevops" ,
		getUrl: "https://azure.microsoft.com/en-us/services/devops"
	},
	slack: { displayName: "Slack", icon: "slack" }
};
