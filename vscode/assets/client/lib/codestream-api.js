import { normalize } from "./actions/utils";
import { cacheMarkerLocations } from "./actions/marker-location";
import { upsert } from "./local-cache";

const normalizeResponse = response => {
	return Object.entries(response).reduce((result, [key, value]) => {
		result[key] = normalize(value);
		return result;
	}, {});
};
export default class CodeStreamApi {
	constructor(http, db) {
		this.http = http;
		this.db = db;
	}

	async login(email, password) {
		try {
			const response = await this.http.put("/no-auth/login", { email, password });
			const normalizedResponse = normalizeResponse(response);
			this.accessToken = normalizedResponse.accessToken;
			await upsert(this.db, "users", normalizedResponse.user);
			await upsert(this.db, "teams", normalizedResponse.teams);
			await upsert(this.db, "repos", normalizedResponse.repos);

			return normalizedResponse;
		} catch (e) {
			debugger;
			// TODO: handle or plead ignorance?
		}
	}

	updateUserTimeZone(data) {
		return this.http.put("/users/me", data, this.accessToken).then(data => {
			const normalizedResponse = normalizeResponse(data);
			return upsert(this.db, "users", normalizedResponse.user);
		});
	}

	async fetchTeamMembers(teamId) {
		try {
			const response = await this.http.get(`/users?teamId=${teamId}`, this.accessToken);
			const normalizedResponse = normalizeResponse(response);
			await upsert(this.db, "users", normalizedResponse.users);
			return normalizedResponse;
		} catch (e) {}
	}

	async fetchCompanies(companyIds) {
		try {
			const response = await this.http.get(
				`/companies?ids=${companyIds.join(",")}`,
				this.accessToken
			);
			const normalizedResponse = normalizeResponse(response);
			await upsert(this.db, "companies", normalizedResponse.companies);
			return normalizedResponse;
		} catch (e) {}
	}

	async fetchStreams(teamId, repoId, sortId) {
		let url = `/streams?teamId=${teamId}&repoId=${repoId}`;
		if (sortId) url += `&lt=${sortId}`;
		try {
			const response = await this.http.get(url, this.accessToken);
			const normalized = normalizeResponse(response);
			await upsert(this.db, "streams", normalized.streams);
			return normalized;
		} catch (e) {}
	}

	findPostsByStreamId(streamId) {
		return this.db.posts.where({ streamId }).sortBy("seqNum");
	}

	async fetchPosts(mostRecentPost, streamId, teamId, commitHash) {
		let url = `/posts?teamId=${teamId}&streamId=${streamId}&withMarkers`;
		if (commitHash) url += `&commitHash=${commitHash}`;
		if (mostRecentPost) url += `&gt=${mostRecentPost.id}`;
		const response = await this.http.get(url, this.accessToken);
		const normalized = normalizeResponse(response);
		const { posts, markers = [], markerLocations, more } = normalized;
		await upsert(this.db, "posts", posts);
		await upsert(this.db, "markers", markers);
		await cacheMarkerLocations(this.db, markerLocations);
		return normalized;
	}
}
