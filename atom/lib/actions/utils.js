const dedasherizeKeys = object => {
	return Object.entries(object).reduce((result, [key, value]) => {
		if (key.startsWith("_")) result[key.substring(1)] = value;
		else result[key] = value;
		return result;
	}, {});
};

export const normalize = data => {
	if (Array.isArray(data)) return data.map(dedasherizeKeys);
	else return dedasherizeKeys(data);
};
