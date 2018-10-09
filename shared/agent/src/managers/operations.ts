const NESTED_PROPERTY_REGEX = /^(.+?)\.(.+)$/;

export function isCompleteObject(obj: object): boolean {
	for (const key of Object.keys(obj)) {
		if (operations[key]) {
			return false;
		}
	}
	return true;
}

export const resolve = (
	{ id, ...object }: { id: string; object: any[] },
	changes: { [key: string]: any }
) => {
	const result: { [key: string]: any } = { ...object };
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
};

const handle = (property: any, object: any, data: any, recurse: any, apply: any) => {
	const nestedPropertyMatch = property.match(NESTED_PROPERTY_REGEX);
	if (nestedPropertyMatch) {
		const [, topField, subField] = nestedPropertyMatch;
		if (object[topField] === undefined) object[topField] = {};
		if (typeof object[topField] === "object") {
			recurse(object[topField], { [subField]: data[property] });
		}
	} else apply();
};

const operations = {
	$set(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$set, () => (object[property] = data[property]));
		});
	},
	$unset(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$unset, () => delete object[property]);
		});
	},
	$push(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$push, () => {
				const value = object[property];
				if (Array.isArray(value)) value.push(data[property]);
			});
		});
	},
	$pull(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$pull, () => {
				const value = object[property];
				if (Array.isArray(value)) {
					if (Array.isArray(data[property])) {
						object[property] = value.filter(it => !data[property].includes(it));
					} else object[property] = value.filter(it => it !== data[property]);
				}
			});
		});
	},
	$addToSet(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$addToSet, () => {
				let newValue = data[property];
				if (!Array.isArray(newValue)) newValue = [newValue];
				const currentValue = object[property];
				if (currentValue === undefined) object[property] = newValue;
				else if (Array.isArray(currentValue)) {
					newValue.forEach((value: any) => {
						if (!currentValue.find(it => it === value)) currentValue.push(value);
					});
				}
			});
		});
	},
	$inc(object: any, data: any) {
		Object.keys(data).forEach(property => {
			handle(property, object, data, operations.$inc, () => {
				const value = object[property];
				if (value === undefined) object[property] = data[property];
				else if (Number.isInteger(value)) object[property] = value + data[property];
			});
		});
	}
} as any;
