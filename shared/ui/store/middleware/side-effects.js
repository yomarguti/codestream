import { unique } from "underscore";
import { getStreamForId } from "../../reducers/streams";
import { fetchPosts } from "../../Stream/actions";
import { safe } from "../../utils";

export default store => next => action => {
	if (action.type === "ADD_STREAMS") {
		unique(action.payload, o => o.id).forEach(payload => {
			const { id, isTeamStream, teamId, memberIds } = payload;
			const { session, streams } = store.getState();

			if (isTeamStream || safe(() => memberIds.includes(session.userId))) {
				const stream = getStreamForId(streams, teamId, id);
				if (!stream.isTeamStream && !safe(() => stream.memberIds.includes(session.userId))) {
					requestIdleCallback(
						() => {
							store.dispatch(fetchPosts({ teamId, streamId: id }));
						},
						{ timeout: 2000 }
					);
				}
			}
		});
	}
	return next(action);
};
