import { CodeStreamApi, CSMarker, CSPost, CSRepository, CSStream, CSTeam, CSUser } from "./api";
import { CodeStreamSession } from "./session";

export class Cache {
	private session: CodeStreamSession;
	private posts: Map<string, CSPost>;
	private repos: Map<string, CSRepository>;
	private streams: Map<string, CSStream>;
	private users: Map<string, CSUser>;
	private teams: Map<string, CSTeam>;
	private markers: Map<string, CSMarker>;

	constructor(session: CodeStreamSession) {
		this.session = session;
		this.posts = new Map();
		this.repos = new Map();
		this.streams = new Map();
		this.users = new Map();
		this.teams = new Map();
		this.markers = new Map();
	}

	async resolvePost(changeSet: object) {
		return (await this.resolvePosts([changeSet]))[0];
	}

	resolvePosts(changeSets: object[]) {
		return this._resolveById(this.posts, changeSets, id => this.session.api.getPost(id));
	}

	resolveRepos(changeSets: object[]) {
		return this._resolveById(this.repos, changeSets, id => this.session.api.getRepo(id));
	}

	resolveStreams(changeSets: object[]) {
		return this._resolveById(this.streams, changeSets, async id => {
			try {
				return this.session.api.getStream(id);
			} catch (error) {
				return;
			}
		});
	}

	resolveUsers(changeSets: object[]) {
		return this._resolveById(this.users, changeSets, id => {
			if (id === this.session.userId) {
				return this.session.api.getMe();
			}
			return this.session.api.getUser(id);
		});
	}

	resolveTeams(changeSets: object[]) {
		return this._resolveById(this.teams, changeSets, id => this.session.api.getTeam(id));
	}

	resolveMarkers(changeSets: object[]) {
		return this._resolveById(this.markers, changeSets, id => this.session.api.getMarker(id));
	}

	private async _resolveById(
		cache: Map<string, any>,
		changeSets: object[],
		fetch: (id: string) => Promise<any>
	) {
		const resolved = await Promise.all(
			changeSets.map(async c => {
				const changes = CodeStreamApi.normalizeResponse(c) as { [key: string]: any };
				const record = cache.get(changes["id"]);
				if (record) {
					const updatedRecord = this._resolve(record, changes);
					cache.set(record.id, updatedRecord);
					return updatedRecord;
				} else {
					const updatedRecord = await fetch(changes["id"]);
					if (updatedRecord) {
						cache.set(changes["id"], updatedRecord);
						return updatedRecord;
					}
				}
			})
		);
		return resolved.filter(Boolean);
	}

	private _resolve(
		{ id, ...object }: { id: string; object: any[] },
		changes: { [key: string]: any }
	) {
		const result: { [key: string]: any } = { ...object };
		Object.keys(changes).forEach(change => {
			const operation = operations[change];
			if (operation) {
				operation(result, changes[change]);
				delete changes[change];
			} else {
				const nestedPropertyMatch = change.match(NESTED_PROPERTY_REGEX);
				if (nestedPropertyMatch) {
					const [, topField, subField] = nestedPropertyMatch;
					result[topField] = this._resolve(result[topField], { [subField]: changes[change] });
				} else result[change] = changes[change];
			}
		});
		return result;
	}
}

const NESTED_PROPERTY_REGEX = /^(.+?)\.(.+)$/;

const handle = (property: any, object: any, data: any, recurse: any, apply: any) => {
	const nestedPropertyMatch = property.match(NESTED_PROPERTY_REGEX);
	if (nestedPropertyMatch) {
		const [, topField, subField] = nestedPropertyMatch;
		if (object[topField] === undefined) object[topField] = {};
		if (typeof object[topField] === "object") {
			recurse(object[topField], { [subField]: data[property] });
		}
	} else apply();
};

const operations = {
	$set(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$set, () => (object[property] = data[property]));
		});
	},
	$unset(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$unset, () => delete object[property]);
		});
	},
	$push(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$push, () => {
				const value = object[property];
				if (Array.isArray(value)) value.push(data[property]);
			});
		});
	},
	$pull(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$pull, () => {
				const value = object[property];
				if (Array.isArray(value)) {
					if (Array.isArray(data[property])) {
						object[property] = value.filter(it => !data[property].includes(it));
					} else object[property] = value.filter(it => it !== data[property]);
				}
			});
		});
	},
	$addToSet(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$addToSet, () => {
				let newValue = data[property];
				if (!Array.isArray(newValue)) newValue = [newValue];
				const currentValue = object[property];
				if (currentValue === undefined) object[property] = newValue;
				else if (Array.isArray(currentValue)) {
					newValue.forEach((value: any) => {
						if (!currentValue.find(it => it === value)) currentValue.push(value);
					});
				}
			});
		});
	},
	$inc(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$inc, () => {
				const value = object[property];
				if (value === undefined) object[property] = data[property];
				else if (Number.isInteger(value)) object[property] = value + data[property];
			});
		});
	}
} as any;
