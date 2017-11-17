class ApiRequestError extends Error {
	constructor(message, data) {
		super(message);
		Error.captureStackTrace(this, ApiRequestError);
		this.data = data;
	}
}

const getPath = route => `${atom.config.get("codestream.url")}${route}`;

export async function get(route) {
	const config = {
		headers: new Headers({
			Accept: "application/json",
			"Content-Type": "application/json"
		})
	};
	const response = await fetch(getPath(route), config);
	const json = await response.json();
	if (response.ok) return json;
	else throw new ApiRequestError(json.message, json);
}

export async function post(route, body) {
	const config = {
		method: "POST",
		headers: new Headers({
			Accept: "application/json",
			"Content-Type": "application/json"
		}),
		body: JSON.stringify(body)
	};
	const response = await fetch(getPath(route), config);
	const json = await response.json();
	if (response.ok) return json;
	else throw new ApiRequestError(json.message, json);
}

export default { post };
