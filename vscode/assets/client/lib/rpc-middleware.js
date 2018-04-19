import { normalize } from "./actions/utils";

export default store => {
	window.addEventListener(
		"message",
		event => {
			console.log("received message from extension host", event.data);
			const { type, body } = event.data;
			if (type === 'push-data') {
				store.dispatch({ type: `ADD_${body.type.toUpperCase()}`, payload: normalize(body.payload) });
			}
		},
		false
	);

	return next => action => {
		return next(action);
	};
};
