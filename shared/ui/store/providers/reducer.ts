import { ActionType } from "../common";
import * as actions from "./actions";
import { ProvidersState, ProvidersActionsType } from "./types";
import { CodeStreamState } from "..";
import { CSMe, CSSlackProviderInfo, CSProviderInfos } from "@codestream/protocols/api";
import { mapFilter, safe } from "@codestream/webview/utils";
import { ThirdPartyProviderConfig } from "@codestream/protocols/agent";
import { createSelector } from "reselect";
import { PROVIDER_MAPPINGS } from "@codestream/webview/Stream/CrossPostIssueControls/types";

type ProviderActions = ActionType<typeof actions>;

const initialState: ProvidersState = {};

interface ThirdPartyTeam {
	icon: string;
	providerId: string;
	teamId: string;
	teamName: string;
}

export function reduceProviders(state = initialState, action: ProviderActions) {
	switch (action.type) {
		case "RESET":
			return initialState;
		case ProvidersActionsType.Update:
			return { ...state, ...action.payload };
		default:
			return state;
	}
}

type ProviderPropertyOption = { name: string } | { id: string };
function isNameOption(o: ProviderPropertyOption): o is { name: string } {
	return (o as any).name != undefined;
}

export const isConnected = (state: CodeStreamState, option: ProviderPropertyOption) => {
	const currentUser = state.users[state.session.userId!] as CSMe;
	const { currentTeamId } = state.context;

	// ensure there's provider info for the team
	if (currentUser.providerInfo == undefined || currentUser.providerInfo[currentTeamId] == undefined)
		return false;

	if (isNameOption(option)) {
		const providerName = option.name;
		switch (providerName) {
			case "jiraserver":
			case "github_enterprise":
			case "gitlab_enterprise": {
				// enterprise/on-prem providers need the `hosts` validated
				const info = currentUser.providerInfo[currentTeamId][providerName];
				return (
					info != undefined &&
					info.hosts != undefined &&
					Object.keys(info.hosts).some(host => {
						return state.providers[host] != undefined && info.hosts![host].accessToken != undefined;
					})
				);
			}
			default: {
				// is there an accessToken for the provider?
				const info = currentUser.providerInfo[currentTeamId][providerName];
				if (info == undefined) return false;
				if (info.accessToken != undefined) return true;

				if (["slack", "msteams"].includes(providerName)) {
					const infoPerTeam = (info as any).multiple as { [key: string]: CSProviderInfos };
					if (infoPerTeam && Object.values(infoPerTeam).some(i => i.accessToken != undefined))
						return true;
				}
				return false;
			}
		}
	} else {
		const providerConfig = state.providers[option.id];
		const infoForProvider = currentUser.providerInfo![currentTeamId][providerConfig.name];
		if (infoForProvider == undefined) return false;

		if (!providerConfig.isEnterprise) {
			if (infoForProvider.accessToken) return true;
			const infoPerTeam = (infoForProvider as any).multiple as { [key: string]: CSProviderInfos };
			if (infoPerTeam && Object.values(infoPerTeam).some(i => i.accessToken != undefined))
				return true;
			return false;
		}

		return !!(
			infoForProvider.hosts &&
			infoForProvider.hosts[providerConfig.id] &&
			infoForProvider.hosts[providerConfig.id].accessToken
		);
	}
};

export const getConnectedProviderNames = (state: CodeStreamState) => {
	return mapFilter<ThirdPartyProviderConfig, string>(
		Object.values(state.providers),
		providerConfig => (isConnected(state, providerConfig) ? providerConfig.name : undefined)
	);
};

export const getConnectedProviders = createSelector(
	(state: CodeStreamState) => state,
	(state: CodeStreamState) => {
		return Object.values(state.providers).filter(providerConfig =>
			isConnected(state, providerConfig)
		);
	}
);

export const getConnectedSharingTargets = (state: CodeStreamState) => {
	if (state.session.userId == undefined) return [];

	const currentUser = state.users[state.session.userId] as CSMe;

	if (currentUser.providerInfo == undefined) return [];

	const providerInfo = currentUser.providerInfo[state.context.currentTeamId];

	let teams: ThirdPartyTeam[] = [];

	const slackInfos = safe(() => providerInfo!.slack!.multiple);
	if (slackInfos)
		teams = teams.concat(Object.entries(slackInfos).map(([teamId, info]) => ({
			icon: PROVIDER_MAPPINGS.slack.icon!,
			providerId: getProviderConfig(state, "slack")!.id,
			teamId,
			teamName: info.data!.team_name
		})));

	// const msTeamInfos = safe(() => providerInfo!.msteams!.multiple);
	// if (msTeamInfos)
	// 	teams = teams.concat(Object.entries(msTeamInfos).map(([teamId, info]) => ({
	// 		icon: PROVIDER_MAPPINGS.msteams.icon!,
	// 		providerId: getProviderConfig(state, "msteams")!.id,
	// 		teamId,
	// 		teamName: info.extra!.team_name
	// 	})));

	return teams;
};

export const getProviderConfig = createSelector(
	(state: CodeStreamState) => state.providers,
	(_, name: string) => name,
	(providerConfigs: ProvidersState, name: string) => {
		for (let id in providerConfigs) {
			if (providerConfigs[id].name === name) return providerConfigs[id];
		}
		return undefined;
	}
);
