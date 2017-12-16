import PubNub from "pubnub";
import _ from "underscore-plus";
import { normalize } from "./actions/utils";
import { addPost, addStream } from "./actions/stream";
import { saveUser } from "./actions/user";

export const createReceiver = store => new PubNubReceiver(store);

export default class PubNubReceiver {
	subscribedChannels = [];
	pubnub = null;
	isInitialized = false;

	constructor(store) {
		this.store = store;
	}

	initialize(authKey) {
		this.pubnub = new PubNub({
			authKey,
			subscribeKey: "sub-c-e830d7da-fb14-11e6-9f57-02ee2ddab7fe",
			restore: true
		});
		this.isInitialized = true;
		this.setupListener();
	}

	setupListener() {
		this.pubnub.addListener({
			message: message => {
				const { requestId, ...type } = message;
				const handler = this.getMessageHandler(type);
				if (handler) handler(message.message[type]);
			}
		});
	}

	subscribe(channels) {
		if (!this.isInitialized)
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
				this.store.dispatch(addStream(normalize(stream)));
			},
			post: post => {
				this.store.dispatch(addPost(normalize(post)));
			},
			user: user => {
				this.store.dispatch(saveUser(normalize(user)));
			}
		};

		return handlers[type];
	}
}
