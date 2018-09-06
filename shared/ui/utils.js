import * as uuidv4 from "uuid/v4";

export const toMapBy = (key, entities) =>
	entities.reduce((result, entity) => ({ ...result, [entity[key]]: entity }), {});

export const uuid = () => uuidv4();
export const shortUuid = () => {
	const data = new Uint8Array(16);
	uuidv4(null, data, 0);

	const base64 = btoa(String.fromCharCode.apply(null, data));
	return base64
		.replace(/\+/g, "-") // Replace + with - (see RFC 4648, sec. 5)
		.replace(/\//g, "_") // Replace / with _ (see RFC 4648, sec. 5)
		.substring(0, 22); // Drop '==' padding;
};
