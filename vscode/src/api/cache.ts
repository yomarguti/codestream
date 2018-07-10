import { CSPost, CSRepository, CSStream } from "./types";
import { CodeStreamSession } from "./session";
import { CodeStreamApi } from "./api";

export default class Cache {
	private session: CodeStreamSession;
	private posts: Map<string, CSPost>;
	private repos: Map<string, CSRepository>;
	private streams: Map<string, CSStream>;

	constructor(session: CodeStreamSession) {
		this.session = session;
		this.posts = new Map();
		this.repos = new Map();
		this.streams = new Map();
	}

	resolvePosts(changeSets: object[]) {
		return Promise.all(
			changeSets.map(async c => {
				const changes = CodeStreamApi.normalizeResponse(c);
				const post = this.posts.get(changes["id"]);
				if (post) {
					const updatedPost = this._resolve(post, changes);
					this.posts.set(post.id, updatedPost);
					return updatedPost;
				} else {
					const updatedPost = await this.session.api.getPost(changes["id"]);
					this.posts.set(changes["id"], updatedPost);
					return updatedPost;
				}
			})
		);
	}

	resolveRepos(changeSets: object[]) {
		return Promise.all(
			changeSets.map(async c => {
				const changes = CodeStreamApi.normalizeResponse(c);
				const repo = this.repos.get(changes["id"]);
				if (repo) {
					const updatedRepo = this._resolve(repo, changes);
					this.repos.set(post.id, updatedRepo);
					return updatedRepo;
				} else {
					const updatedRepo = await this.session.api.getRepo(changes["id"]);
					this.repos.set(changes["id"], updatedRepo);
					return updatedRepo;
				}
			})
		);
	}

	resolveStreams(changeSets: object[]) {
		return Promise.all(
			changeSets.map(async c => {
				const changes = CodeStreamApi.normalizeResponse(c);
				const record = this.streams.get(changes["id"]);
				if (record) {
					const updatedRecord = this._resolve(record, changes);
					this.streams.set(record.id, updatedRecord);
					return updatedRecord;
				} else {
					const updatedRecord = await this.session.api.getStream(changes["id"]);
					this.streams.set(changes["id"], updatedRecord);
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
