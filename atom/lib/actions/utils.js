const normalizeObject = ({ _id, ...rest }) => ({ id: _id, ...rest });

export const normalize = data => {
	if (typeof data.map === "function") return data.map(normalizeObject);
	else return normalizeObject(data);
};

export function resolve({ id, ...object }, changes) {
	let result = { ...object };
	if (changes.$set) {
		const values = changes.$set;
		result = { ...result, ...values };
	}
	if (changes.$unset) {
		Object.keys(changes.$unset).forEach(property => (result[property] = undefined));
	}
	if (changes.$push) {
		const data = changes.$push;
		Object.keys(data).forEach(property => {
			const value = result[property];
			if (Array.isArray(value)) value.push(data[property]);
		});
	}
	if (changes.$pull) {
		const data = changes.$pull;
		Object.keys(data).forEach(property => {
			const value = result[property];
			if (Array.isArray(value)) result[property] = value.filter(it => it !== data[property]);
		});
	}
	if (changes.$addToSet) {
		const data = changes.$addToSet;
		Object.keys(data).forEach(property => {
			const value = result[property];
			if (value === undefined) result[property] = data[property];
			else if (Array.isArray(value)) {
				if (!value.find(it => it === data[property])) value.push(data[property]);
			}
		});
	}
	if (changes.$inc) {
		const data = changes.$inc;
		Object.keys(data).forEach(property => {
			const value = result[property];
			if (value === undefined) result[property] = 0 + data[property];
			else if (Number.isInteger(value)) result[property] = value + data[property];
		});
	}
	return result;
}
