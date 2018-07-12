import { CSMarker, CSPost, CSRepository, CSStream, CSTeam, CSUser } from "./types";
import { CodeStreamSession } from "./session";
import { CodeStreamApi } from "./api";

export default class Cache {
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

	resolvePosts(changeSets: object[]) {
		return this._resolveById(this.posts, changeSets, id => this.session.api.getPost(id));
	}

	resolveRepos(changeSets: object[]) {
		return this._resolveById(this.repos, changeSets, id => this.session.api.getRepo(id));
	}

	resolveStreams(changeSets: object[]) {
		return this._resolveById(this.streams, changeSets, id => this.session.api.getStream(id));
	}

	resolveUsers(changeSets: object[]) {
		return this._resolveById(this.users, changeSets, id => this.session.api.getUser(id));
	}

	resolveTeams(changeSets: object[]) {
		return this._resolveById(this.teams, changeSets, id => this.session.api.getTeam(id));
	}

	resolveMarkers(changeSets: object[]) {
		return this._resolveById(this.markers, changeSets, id => this.session.api.getMarker(id));
	}

	private _resolveById(
		cache: Map<string, any>,
		changeSets: object[],
		fetch: (id: string) => Promise<any>
	) {
		return Promise.all(
			changeSets.map(async c => {
				const changes = CodeStreamApi.normalizeResponse(c);
				const record = cache.get(changes["id"]);
				if (record) {
					const updatedRecord = this._resolve(record, changes);
					cache.set(record.id, updatedRecord);
					return updatedRecord;
				} else {
					const updatedRecord = await fetch(changes["id"]);
					cache.set(changes["id"], updatedRecord);
					return updatedRecord;
				}
			})
		);
	}

	private _resolve({ id, ...object }, changes) {
		let result = { ...object };
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

const handle = (property, object, data, recurse, apply) => {
	const nestedPropertyMatch = property.match(NESTED_PROPERTY_REGEX);
	if (nestedPropertyMatch) {
		let [, topField, subField] = nestedPropertyMatch;
		if (object[topField] === undefined) object[topField] = {};
		if (typeof object[topField] === "object")
			recurse(object[topField], { [subField]: data[property] });
	} else apply();
};

const operations = {
	$set(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$set, () => (object[property] = data[property]));
		});
	},
	$unset(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$unset, () => (object[property] = undefined));
		});
	},
	$push(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$push, () => {
				const value = object[property];
				if (Array.isArray(value)) value.push(data[property]);
			});
		});
	},
	$pull(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$pull, () => {
				const value = object[property];
				if (Array.isArray(value)) {
					if (Array.isArray(data[property]))
						object[property] = value.filter(it => !_.contains(data[property], it));
					else object[property] = value.filter(it => it !== data[property]);
				}
			});
		});
	},
	$addToSet(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$addToSet, () => {
				let newValue = data[property];
				if (!Array.isArray(newValue)) newValue = [newValue];
				const currentValue = object[property];
				if (currentValue === undefined) object[property] = newValue;
				else if (Array.isArray(currentValue)) {
					newValue.forEach(value => {
						if (!currentValue.find(it => it === value)) currentValue.push(value);
					});
				}
			});
		});
	},
	$inc(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$inc, () => {
				const value = object[property];
				if (value === undefined) object[property] = data[property];
				else if (Number.isInteger(value)) object[property] = value + data[property];
			});
		});
	}
};
