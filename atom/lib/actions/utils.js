const normalizeObject = ({ _id, ...rest }) => ({ id: _id, ...rest });

export const normalize = data => {
	if (typeof data.map === "function") return data.map(normalizeObject);
	else return normalizeObject(data);
};

const NESTED_PROPERTY_REGEX = /^(.+)\.(.+)$/;

const handle = (property, object, data, recurse, apply) => {
	const nestedPropertyMatch = property.match(NESTED_PROPERTY_REGEX);
	if (nestedPropertyMatch) {
		let [, topField, subField] = nestedPropertyMatch;
		if (typeof object[topField] === "object")
			recurse(object[topField], { [subField]: data[property] });
	} else apply();
};

const operations = {
	$set(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$set, () => (object[property] = data[property]));
		});
	},
	$unset(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$unset, () => (object[property] = undefined));
		});
	},
	$push(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$push, () => {
				const value = object[property];
				if (Array.isArray(value)) value.push(data[property]);
			});
		});
	},
	$pull(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$pull, () => {
				const value = object[property];
				if (Array.isArray(value)) object[property] = value.filter(it => it !== data[property]);
			});
		});
	},
	$addToSet(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$addToSet, () => {
				const value = object[property];
				if (value === undefined) object[property] = [data[property]];
				else if (Array.isArray(value)) {
					if (!value.find(it => it === data[property])) value.push(data[property]);
				}
			});
		});
	},
	$inc(object, data) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$inc, () => {
				const value = object[property];
				if (value === undefined) object[property] = data[property];
				else if (Number.isInteger(value)) object[property] = value + data[property];
			});
		});
	}
};

export function resolve({ id, ...object }, changes) {
	let result = { ...object };
	Object.keys(changes).forEach(change => {
		const operation = operations[change];
		if (operation) {
			operation(result, changes[change]);
			delete changes[change];
		} else {
			const nestedPropertyMatch = change.match(NESTED_PROPERTY_REGEX);
			if (nestedPropertyMatch) {
				const [, topField, subField] = nestedPropertyMatch;
				result[topField] = resolve(result[topField], { [subField]: changes[change] });
			} else result[change] = changes[change];
		}
	});
	return result;
}
