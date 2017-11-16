class ApiRequestError extends Error {
	constructor(message, data) {
		super(message);
		Error.captureStackTrace(this, ApiRequestError);
		this.data = data;
	}
}

export async function post(url, body) {
	const config = {
		method: "POST",
		headers: new Headers({
			Accept: "application/json",
			"Content-Type": "application/json"
		}),
		body: JSON.stringify(body)
	};
	const response = await fetch(url, config);
	const json = await response.json();
	if (response.status >= 200 && response.status < 300) return json;
	else throw new ApiRequestError(json.message, json);
}

export default { post };
