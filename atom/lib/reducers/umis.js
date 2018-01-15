import { toMapBy } from "./utils";
import _ from "underscore-plus";

const initialState = { counter: 0 };

export default (state = initialState, { type, payload }) => {
	switch (type) {
		case "INCREMENT_UMI": {
			console.log("incrementint umis in the reducer: ", payload);
			if (!state.unread) state.unread = {};
			state.unread[payload] = (state.unread[payload] || 0) + 1;
			state.counter = (state.counter || 0) + 1;
			console.log("STATE IS: ", state);
			return state;
		}
		case "INCREMENT_MENTION": {
			console.log("incrementing mention in the reducer: ", payload);
			// payload is a streamId
			if (!state.mentions) state.mentions = {};
			if (!state.unread) state.unread = {};
			state.mentions[payload] = (state.mentions[payload] || 0) + 1;
			state.unread[payload] = (state.unread[payload] || 0) + 1;
			state.counter = (state.counter || 0) + 1;
			return state;
		}
		case "CLEAR_UMI": {
			console.log("clear umis in the reducer: ", payload);
			// instead of deleting it, we set it to zero
			// so that when we loop through the keys we can
			// still reference the fact that this div needs to be cleared
			if (!state.mentions) state.mentions = {};
			if (!state.unread) state.unread = {};
			if (state.mentions[payload]) state.mentions[payload] = 0;
			if (state.unread[payload]) state.unread[payload] = 0;
			// delete state[payload];
			state.counter = (state.counter || 0) + 1;
			return state;
		}
		case "RECALCULATE_UMI": {
			state.mentions = {};
			state.unread = {};
			console.log("RECALCULATING UMI: ", payload);
			let mentionRegExp = new RegExp("@" + payload.currentUser.username + "\\b");

			let lastReads = payload.currentUser.lastReads;
			state = { mentions: {}, unread: {} };
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
					if (unread) state.unread[key] = unread;
					if (mentions) state.mentions[key] = mentions;
				}
			});
			state.counter = (state.counter || 0) + 1;
			return state;
		}
		default:
			return state;
	}
	return state;
};
