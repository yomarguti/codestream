import PubNub from "pubnub";
import _ from "underscore-plus";
import { normalize } from "./actions/utils";
import { resolveFromPubnub } from "./actions/pubnub-event";
import { saveStream, saveStreams } from "./actions/stream";
import { savePost, savePosts } from "./actions/post";
import { saveUser, saveUsers } from "./actions/user";
import { saveTeam, saveTeams } from "./actions/team";
import { saveRepo, saveRepos } from "./actions/repo";
import { saveMarker, saveMarkers } from "./actions/marker";
import { saveMarkerLocations } from "./actions/marker-location";

export const createReceiver = store => new PubNubReceiver(store);

export default class PubNubReceiver {
	subscribedChannels = [];
	pubnub = null;

	constructor(store) {
		this.store = store;
	}

	initialize(authKey) {
		this.pubnub = new PubNub({
			authKey,
			subscribeKey: "sub-c-e830d7da-fb14-11e6-9f57-02ee2ddab7fe",
			restore: true
		});
		this.setupListener();
	}

	setupListener() {
		this.pubnub.addListener({
			message: event => {
				const { requestId, ...objects } = event.message;
				console.debug(`pubnub event - ${requestId}`, event.message);
				Object.keys(objects).forEach(key => {
					const handler = this.getMessageHandler(key);
					if (handler) handler(objects[key]);
				});
			}
		});
	}

	subscribe(channels) {
		if (this.pubnub === null)
			throw new Error(
				"PubNubReceiver must be initialized with an authKey before subscribing to channels"
			);

		const newChannels = _.difference(channels, this.subscribedChannels);
		this.pubnub.subscribe({ channels: newChannels });
		this.subscribedChannels.push(...newChannels);
	}

	getMessageHandler(type) {
		let tableName;
		switch (type) {
			case "stream":
			case "streams":
				tableName = "streams";
				break;
			case "post":
			case "posts":
				tableName = "posts";
				break;
			case "user":
			case "users":
				tableName = "users";
				break;
			case "team":
			case "teams":
				tableName = "teams";
				break;
			case "repo":
			case "repos":
				tableName = "repos";
				break;
			case "marker":
			case "markers":
				tableName = "markers";
				break;
			case "markerLocations":
				tableName = "markerLocations";
				break;
		}
		if (tableName)
			return data => this.store.dispatch(resolveFromPubnub(tableName, normalize(data)));
	}
}
