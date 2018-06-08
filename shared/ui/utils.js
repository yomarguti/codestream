export const toMapBy = (key, entities) =>
	entities.reduce((result, entity) => ({ ...result, [entity[key]]: entity }), {});

// uuid generator taken from: https://gist.github.com/jed/982883
export const uuid = a =>
	a
		? (a ^ ((Math.random() * 16) >> (a / 4))).toString(16)
		: ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, uuid);
