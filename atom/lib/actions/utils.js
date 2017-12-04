const normalizeObject = ({ _id, ...rest }) => ({ id: _id, ...rest });

export const normalize = data => {
	if (typeof data.map === "function") return data.map(normalizeObject);
	else return normalizeObject(data);
};
