"use strict";

import { Container } from "../container";
import { CSTeam } from "../shared/api.protocol";
import { EntityManager, Id } from "./managers";

export class TeamManager extends EntityManager<CSTeam> {
	private loaded = false;

	public async getAll(): Promise<CSTeam[]> {
		if (!this.loaded) {
			const { api, session } = Container.instance();
			const response = await api.getTeams(session.apiToken, [session.teamId]);
			for (const team of response.teams) {
				this.cache.set(team);
			}
			this.loaded = true;
		}

		return this.cache.getAll();
	}

	protected async fetch(teamId: Id): Promise<CSTeam> {
		const { api, session } = Container.instance();
		const response = await api.getTeam(session.apiToken, teamId);
		return response.team;
	}
}
