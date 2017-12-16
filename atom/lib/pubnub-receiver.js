import PubNub from "pubnub";
import _ from "underscore-plus";
import { normalize } from "./actions/utils";
import { savePost, saveStream } from "./actions/stream";
import { saveUser } from "./actions/user";

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
			stream: stream => {
				this.store.dispatch(saveStream(normalize(stream)));
			},
			post: post => {
				this.store.dispatch(savePost(normalize(post)));
			},
			user: user => {
				this.store.dispatch(saveUser(normalize(user)));
			}
		};

		return handlers[type];
	}
}
