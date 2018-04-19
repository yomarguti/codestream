const isObject = x => {
	let prototype;
	return (
		Object.prototype.toString.call(x) === "[object Object]" &&
		((prototype = Object.getPrototypeOf(x)),
		prototype === null || prototype === Object.getPrototypeOf({}))
	);
};

const dedasherizeKeys = object => {
	return Object.entries(object).reduce((result, [key, value]) => {
		if (key.startsWith("_")) result[key.substring(1)] = value;
		else result[key] = value;
		return result;
	}, {});
};

export const normalize = data => {
	if (Array.isArray(data)) return data.map(dedasherizeKeys);
	else if (!isObject(data)) return data;
	else return dedasherizeKeys(data);
};
