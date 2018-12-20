"use strict";
import { CSMe, CSProviderInfos, CSSlackProviderInfo, CSTeam } from "../shared/api.protocol";

export namespace Team {
	export function isSlack(
		team: CSTeam
	): team is CSTeam & { providerInfo: { slack: CSSlackProviderInfo } } {
		return team.providerInfo != null && team.providerInfo.slack != null;
	}
}

export namespace User {
	export function isSlack(me: CSMe): me is CSMe & { providerInfo: { slack: CSSlackProviderInfo } } {
		return (
			me.providerInfo != null &&
			(me.providerInfo.slack != null ||
				Object.values(me.providerInfo).some(provider => provider.slack != null))
		);
	}

	export function getProviderInfo<T extends CSProviderInfos>(
		me: CSMe,
		teamId: string,
		name: string
	) {
		if (me.providerInfo == null) return undefined;

		const provider = me.providerInfo[teamId];
		if (provider == null) return;

		return provider[name] as T;
	}
}
