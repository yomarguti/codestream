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
}

export const PROVIDER_MAPPINGS: { [provider: string]: ProviderDisplay } = {
	asana: { displayName: "Asana" },
	bitbucket: { displayName: "Bitbucket" },
	github: { displayName: "GitHub", icon: "mark-github" },
	gitlab: { displayName: "GitLab" },
	jira: { displayName: "Jira" },
	trello: { displayName: "Trello" },
	slack: { displayName: "Slack" }
};
