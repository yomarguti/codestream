const normalizeObject = ({ _id, ...rest }) => ({ id: _id, ...rest });

export const normalize = data => {
	if (Array.isArray(data)) return data.map(normalizeObject);
	else return normalizeObject(data);
};
