import { toMapBy } from "./utils";
import _ from "underscore-plus";

const initialState = { counter: 0 };

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "INCREMENT_UMI": {
			console.log("incrementint umis in the reducer: ", payload);
			let nextState = { ...state };
			if (!nextState.unread) nextState.unread = {};
			nextState.unread[payload] = (nextState.unread[payload] || 0) + 1;
			nextState.counter = (nextState.counter || 0) + 1;
			console.log("STATE IS: ", nextState);
			return nextState;
		}
		case "INCREMENT_MENTION": {
			console.log("incrementing mention in the reducer: ", payload);
			// payload is a streamId
			let nextState = { ...state };
			if (!nextState.mentions) nextState.mentions = {};
			if (!nextState.unread) nextState.unread = {};
			nextState.mentions[payload] = (nextState.mentions[payload] || 0) + 1;
			nextState.unread[payload] = (nextState.unread[payload] || 0) + 1;
			nextState.counter = (nextState.counter || 0) + 1;
			return nextState;
		}
		case "CLEAR_UMI": {
			console.log("clear umis in the reducer: ", payload);
			let nextState = { ...state };
			// instead of deleting it, we set it to zero
			// so that when we loop through the keys we can
			// still reference the fact that this div needs to be cleared
			if (!nextState.mentions) nextState.mentions = {};
			if (!nextState.unread) nextState.unread = {};
			if (nextState.mentions[payload]) nextState.mentions[payload] = 0;
			if (nextState.unread[payload]) nextState.unread[payload] = 0;
			return nextState;
		}
		case "RECALCULATE_UMI": {
			let nextState = {};
			nextState.mentions = {};
			nextState.unread = {};
			console.log("RECALCULATING UMI: ", payload);
			let mentionRegExp = new RegExp("@" + payload.currentUser.username + "\\b");

			let lastReads = payload.currentUser.lastReads;
			nextState = { mentions: {}, unread: {} };
			let streamsById = {};
			Object.keys(payload.streams.byFile).forEach(key => {
				streamsById[payload.streams.byFile[key].id] = payload.streams.byFile[key];
			});
			Object.keys(lastReads).forEach(key => {
				let lastRead = lastReads[key];
				let unread = 0;
				let mentions = 0;
				if (lastRead) {
					// find the stream for key
					// then calculate the unread Messages
					let stream = streamsById[key];
					let posts = _.sortBy(payload.posts.byStream[key]);
					// return _.sortBy(byStream[streamId], "seqNum");

					if (!posts) return;
					let postIds = posts.map(post => {
						return post.id;
					});
					let index = postIds.indexOf(lastRead);
					for (let i = index; i < posts.length; i++) {
						unread++;
						let post = posts[i];
						if (post && post.text && post.text.match(mentionRegExp)) {
							mentions++;
						}
					}
					if (unread) nextState.unread[key] = unread;
					if (mentions) nextState.mentions[key] = mentions;
				}
			});
			return nextState;
		}
		default:
			return state;
	}
	return state;
};
