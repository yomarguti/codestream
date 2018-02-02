import PubNub from "pubnub";
import Raven from "raven-js";
import _ from "underscore-plus";
import { normalize } from "./actions/utils";
import { resolveFromPubnub } from "./actions/pubnub-event";
import { saveMarkerLocations } from "./actions/marker-location";
import { lastMessageReceived } from "./actions/messaging";
import rootLogger from "./util/Logger";

const logger = rootLogger.forClass("pubnub-receiver");

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
			message: this.pubnubEvent.bind(this),
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

	pubnubEvent(event) {
		this.store.dispatch(lastMessageReceived(event.timetoken));
		this.pubnubMessage(event.timetoken, event.message);
	}

	pubnubMessage(timetoken, message, { isHistory = false } = {}) {
		const { requestId, ...objects } = message;
		// console.log(`pubnub event - ${requestId}`, message);
		Raven.captureBreadcrumb({
			message: "pubnub event",
			category: "pubnub",
			data: { requestId, isHistory, ...Object.keys(objects) },
			level: "debug"
		});
		Object.keys(objects).forEach(key => {
			const handler = this.getMessageHandler(key);
			if (handler) handler(objects[key], isHistory);
		});
		if (isHistory) {
			if (this.lastHistoryTimeToken === timetoken) this.store.dispatch({ type: "CAUGHT_UP" });
		}
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
			Raven.captureBreadcrumb({
				message: `Subscribed to ${channel}`,
				category: "pubnub",
				level: "info"
			});
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
			return (data, isHistory) =>
				this.store.dispatch(resolveFromPubnub(tableName, normalize(data), isHistory));
	}

	async retrieveHistory(channels, messaging = {}) {
		let retrieveSince;
		if (messaging.lastMessageReceived) {
			retrieveSince = messaging.lastMessageReceived;
		} else {
			// once this mechanism is in operation this should never happen, but until then,
			// we'll need to invent a beginning of time (like before codestream existed)
			retrieveSince = (new Date("1/1/2018").getTime() * 10000).toString();
		}
		// FIXME: there probably needs to be a time limit here, where we assume it isn't
		// worth replaying all the messages ... instead we just wipe the DB and refresh
		// the session ... maybe a week?
		return await this.retrieveHistorySince(channels, retrieveSince);
	}

	async retrieveHistorySince(channels, timeToken) {
		let allMessages = [];
		await Promise.all(
			channels.map(channel => {
				return this.retrieveChannelHistorySince(channel, timeToken, allMessages);
			})
		);
		allMessages.forEach(message => {
			message.timestamp = parseInt(message.timetoken, 10) / 10000;
		});
		allMessages.sort((a, b) => {
			return a.timestamp - b.timestamp;
		});

		if (allMessages.length > 0) {
			const lastMessage = allMessages[allMessages.length - 1];
			this.lastHistoryTimeToken = lastMessage.timetoken;
			this.store.dispatch(lastMessageReceived(lastMessage.timetoken));
		} else this.store.dispatch({ type: "CAUGHT_UP" });

		for (var message of allMessages) {
			this.pubnubMessage(message.timetoken, message.entry, { isHistory: true });
		}
	}

	async retrieveChannelHistorySince(channel, timeToken, allMessages) {
		let response;
		try {
			response = await this.pubnub.history({
				channel: channel,
				reverse: true, // oldest message first
				start: timeToken,
				stringifiedTimeToken: true
			});
		} catch (error) {
			// FIXME: this should be fatal, or perhaps lead to a session refresh
			console.warn("PubNub history failed: ", error);
			return true;
		}
		allMessages.push(...response.messages);
		if (response.messages.length < 100) {
			return true;
		} else {
			// FIXME: we can't let this go on too deep, there needs to be a limit
			// once we reach that limit, we probably need to just clear the database and
			// refresh the session (like you're coming back from vacation)
			return this.retrieveChannelHistorySince(channel, response.endTimeToken, allMessages);
		}
	}
}
