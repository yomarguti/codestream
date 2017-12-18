import PubNub from "pubnub";
import _ from "underscore-plus";
import { normalize } from "./actions/utils";
import { saveStream, saveStreams } from "./actions/stream";
import { savePost, savePosts } from "./actions/post";
import { saveUser, saveUsers } from "./actions/user";
import { saveTeam, saveTeams } from "./actions/team";
import { saveRepo, saveRepos } from "./actions/repo";
import { saveMarker, saveMarkers } from "./actions/marker";

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
				const { requestId, ...rest } = event.message;
				const type = Object.keys(rest)[0];
				const handler = this.getMessageHandler(type);
				if (handler) handler(event.message[type]);
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
		const handlers = {
			stream: stream => this.store.dispatch(saveStream(normalize(stream))),
			streams: streams => this.store.dispatch(saveStreams(normalize(streams))),
			post: post => this.store.dispatch(savePost(normalize(post))),
			posts: posts => this.store.dispatch(savePosts(normalize(posts))),
			user: user => this.store.dispatch(saveUser(normalize(user))),
			users: users => this.store.dispatch(saveUsers(normalize(users))),
			team: team => this.store.dispatch(saveTeam(normalize(team))),
			teams: teams => this.store.dispatch(saveTeams(normalize(teams))),
			repo: repo => this.store.dispatch(saveRepo(normalize(repo))),
			repos: repos => this.store.dispatch(saveRepos(normalize(repos))),
			marker: marker => this.store.dispatch(saveMarker(normalize(marker))),
			markers: markers => this.store.dispatch(saveMarkers(normalize(markers)))
			// TODO: markerLocations
		};

		return handlers[type];
	}
}
