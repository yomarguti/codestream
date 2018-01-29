import PubNub from "pubnub";
import _ from "underscore-plus";
import { normalize } from "./actions/utils";
import { resolveFromPubnub } from "./actions/pubnub-event";
import { saveMarkerLocations } from "./actions/marker-location";
import rootLogger from "./util/Logger";

const logger = rootLogger.forClass("pubnub-receiver");

export const createReceiver = store => new PubNubReceiver(store);

export default class PubNubReceiver {
	subscribedChannels = [];
	pubnub = null;

	constructor(store) {
		this.store = store;
	}

	initialize(authKey, uuid) {
		this.pubnub = new PubNub({
			authKey,
			uuid,
			publishKey: "pub-c-8603fed4-39da-4feb-a82e-cf5311ddb4d6",
			subscribeKey: "sub-c-e830d7da-fb14-11e6-9f57-02ee2ddab7fe",
			restore: true,
			logVerbosity: false,
			heartBeatInterval: 30
		});
		this.setupListener();
	}

	isInitialized() {
		return Boolean(this.pubNub);
	}

	setupListener() {
		this.pubnub.addListener({
			message: event => {
				const { requestId, ...objects } = event.message;
				logger.debug(`pubnub event - ${requestId}`, event.message);
				Object.keys(objects).forEach(key => {
					const handler = this.getMessageHandler(key);
					if (handler) handler(objects[key]);
				});
			},
			presence: event => {
				// logger.debug(event.action); // online status events
				// logger.debug(event.timestamp); // timestamp on the event is occurred
				// logger.debug(event.uuid); // uuid of the user
				logger.debug(`user ${event.uuid} ${event.action}. occupancy is ${event.occupancy}`); // uuid of the user
			},
			status: status => {
				logger.debug("pubnub status", status);
			}
		});
	}

	subscribe(channels) {
		if (this.pubnub === null)
			throw new Error(
				"PubNubReceiver must be initialized with an authKey and userId before subscribing to channels"
			);

		const newChannels = _.difference(channels, this.subscribedChannels);
		newChannels.forEach(channel => {
			logger.debug("subscribing to", channel);
			this.pubnub.subscribe({
				channels: [channel],
				withPresence: !channel.includes("user")
			});
			this.subscribedChannels.push(channel);
		});
	}

	unsubscribeAll() {
		this.subscribedChannels = [];
		this.pubnub && this.pubnub.unsubscribeAll();
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
				return data => this.store.dispatch(saveMarkerLocations(normalize(data)));
		}
		if (tableName)
			return data => this.store.dispatch(resolveFromPubnub(tableName, normalize(data)));
	}
}
