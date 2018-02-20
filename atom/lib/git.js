import { BufferedProcess } from "atom";

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
			exit: code => (code === 0 ? resolve(output) : reject(output))
		});
		bufferedProcess.onWillThrowError(error => {
			atom.notifications.addError(
				//FIXME loc
				"CodeStream is unable to locate the git command. Please ensure git is in your PATH."
			);
			reject();
		});
	});
};
