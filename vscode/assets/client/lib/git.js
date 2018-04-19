import { BufferedProcess } from "atom";

const createError = message =>
	message.includes("'git' is not recognized") ? { missingGit: true } : { message };

export default (args, options = {}) => {
	return new Promise((resolve, reject) => {
		let output = "";
		const bufferedProcess = new BufferedProcess({
			command: "git",
			args,
			options: { env: process.env, ...options },
			stdout: data => {
				output += data.toString();
			},
			stderr: data => {
				output += data.toString();
			},
			exit: code => (code === 0 ? resolve(output) : reject(createError(output)))
		});

		bufferedProcess.onWillThrowError(error => {
			reject();
		});
	});
};
