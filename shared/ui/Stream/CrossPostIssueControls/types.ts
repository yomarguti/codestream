export interface Service {
	name: string;
	displayName: string;
	icon?: string;
}

export interface CardValues {
	isEnabled: boolean;
	provider: string;
	board?: Board;
	[key: string]: any;
}
export type CrossPostIssueValuesListener = (values: CardValues) => any;

export interface Board {
	id: string;
	name: string;
	apiIdentifier?: string;
	assigneesRequired: boolean;
	assigneesDisabled?: boolean;
	singleAssignee?: boolean;
	[key: string]: any;
}

export const SUPPORTED_SERVICES = {
	Trello: { name: "trello", displayName: "Trello" },
	Jira: { name: "jira", displayName: "Jira" },
	GitHub: { name: "github", icon: "mark-github", displayName: "GitHub" },
	GitLab: { name: "gitlab", displayName: "GitLab" },
	Asana: { name: "asana", displayName: "Asana" },
	Bitbucket: { name: "bitbucket", displayName: "Bitbucket" }
};

export function getProviderInfo(name: string): Service {
	return Object.values(SUPPORTED_SERVICES).find(s => s.name === name)!;
}
