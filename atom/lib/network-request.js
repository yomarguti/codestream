class ApiRequestError extends Error {
	constructor(message, data) {
		super(message);
		Error.captureStackTrace(this, ApiRequestError);
		this.data = data;
	}
}

const getPath = route => `${atom.config.get("CodeStream.url")}${route}`;
const getHeaders = () =>
	new Headers({
		Accept: "application/json",
		"Content-Type": "application/json"
	});

export async function get(route, accessToken) {
	const headers = getHeaders();
	if (accessToken) {
		headers.set("Authorization", `Bearer ${accessToken}`);
	}
	const config = { headers };
	const response = await fetch(getPath(route), config);
	const json = await response.json();
	if (response.ok) return json;
	else throw new ApiRequestError(json.message, json);
}

export async function post(route, body, accessToken) {
	const headers = getHeaders();
	if (accessToken) {
		headers.set("Authorization", `Bearer ${accessToken}`);
	}
	const config = {
		headers,
		method: "POST",
		body: JSON.stringify(body)
	};
	const response = await fetch(getPath(route), config);
	const json = await response.json();
	if (response.ok) return json;
	else throw new ApiRequestError(json.message, json);
}

export async function put(route, body) {
	const config = {
		headers: getHeaders(),
		method: "PUT",
		body: JSON.stringify(body)
	};
	const response = await fetch(getPath(route), config);
	const json = await response.json();
	if (response.ok) return json;
	else throw new ApiRequestError(json.message, json);
}

export default { get, post, put };
