"use strict";
import {
	FetchTeamsRequest,
	FetchTeamsRequestType,
	FetchTeamsResponse,
	GetTeamRequest,
	GetTeamRequestType,
	GetTeamResponse
} from "../shared/agent.protocol";
import { CSTeam } from "../shared/api.protocol";
import { lspHandler } from "../system";
import { EntityManager, Id } from "./entityManager";

export class TeamsManager extends EntityManager<CSTeam> {
	private loaded = false;

	async getAll(): Promise<CSTeam[]> {
		if (!this.loaded) {
			const response = await this.session.api.fetchTeams({ mine: true });
			for (const team of response.teams) {
				this.cache.set(team);
			}
			this.loaded = true;
		}

		return this.cache.getAll();
	}

	protected async fetchById(teamId: Id): Promise<CSTeam> {
		const response = await this.session.api.getTeam({ teamId: teamId });
		return response.team;
	}

	@lspHandler(GetTeamRequestType)
	private async getTeam(request: GetTeamRequest): Promise<GetTeamResponse> {
		const team = await this.getById(request.teamId);
		return { team: team };
	}

	@lspHandler(FetchTeamsRequestType)
	private async fetchTeams(request: FetchTeamsRequest): Promise<FetchTeamsResponse> {
		const teams = await this.getAll();
		if (request.teamIds == null || request.teamIds.length === 0) {
			return { teams: teams };
		}

		return { teams: teams.filter(t => request.teamIds!.includes(t.id)) };
	}
}
