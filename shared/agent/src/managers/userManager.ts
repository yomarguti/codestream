"use strict";

import { Container } from "../container";
import { CSUser } from "../shared/api.protocol";
import { EntityManager, Id } from "./managers";

export class UserManager extends EntityManager<CSUser> {
	private loaded = false;

	public async getAll(): Promise<CSUser[]> {
		if (!this.loaded) {
			const { api, session } = Container.instance();
			const response = await api.getUsers(session.apiToken, session.teamId);
			for (const user of response.users) {
				this.cache.set(user);
			}
			this.loaded = true;
		}

		return this.cache.getAll();
	}

	protected async fetch(userId: Id): Promise<CSUser> {
		const { api, session } = Container.instance();
		const response = await api.getUser(session.apiToken, session.teamId, userId);
		return response.user;
	}
}
