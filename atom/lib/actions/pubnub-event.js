import { resolve } from "./utils";

export const resolveFromPubnub = (tableName, changes) => (dispatch, getState, { db }) => {
	const table = db.table(tableName);

	if (Array.isArray(changes))
		return Promise.all(changes.map(change => dispatch(resolveFromPubnub(tableName, change))));
	else {
		return table
			.get(changes.id)
			.then(async record => {
				if (record) {
					await table.update(changes.id, resolve(record, changes));
					return table.get(changes.id);
				}
				// else {
				// 	// TODO: fetch a new record from server?
				// }
			})
			.then(record =>
				dispatch({ type: `${tableName.toUpperCase()}-UPDATE_FROM_PUBNUB`, payload: record })
			);
	}
};
