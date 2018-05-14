const GitCommander = require("./gitCommander");

export default class Blamer {
	constructor(repo) {
		if (!repo) {
			throw new Error("Cannot create a Blamer without a repository.");
		}
		this.repo = repo;
		this.initialize();
	}

	initialize() {
		this.tools = {};
		this.tools.root = new GitCommander(this.repo.getWorkingDirectory());

		var submodules = this.repo.submodules;
		if (submodules) {
			for (var submodulePath in submodules) {
				this.tools[submodulePath] = new GitCommander(
					this.repo.getWorkingDirectory() + "/" + submodulePath
				);
			}
		}
	}

	/**
	 * Blames the given filePath and calls callback with blame lines or error.
	 *
	 * @param {string} filePath - filePath to blame
	 * @param {function} callback - callback to call back with blame data
	 */
	blame(filePath, range) {
		// Ensure file path is relative to root repo
		filePath = this.repo.relativize(filePath);
		const repoUtil = this.repoUtilForPath(filePath);

		// Ensure that if this file is in a submodule, we remove the submodule dir
		// from the path
		filePath = this.removeSubmodulePrefix(filePath);

		// Make the async blame call on the git repo
		return new Promise((resolve, reject) => {
			repoUtil.blame(filePath, function(err, blame) {
				if (err) return reject(err);

				const authors = [];
				for (var lineNum = range.start.row; lineNum <= range.end.row; lineNum++) {
					var lineData = blame[lineNum - 1];
					if (lineData) {
						const authorEmail = lineData["email"];
						if (authorEmail && authorEmail !== "not.committed.yet") {
							if (!authors.includes(authorEmail)) authors.push(authorEmail);
						}
					}
				}

				resolve(authors);
			});
		});
	}

	repoUtilForPath(filePath) {
		var submodules = this.repo.submodules;

		// By default, we return the root GitCommander repository.
		var repoUtil = this.tools.root;

		// if we have submodules, loop through them and see if the given file path
		// belongs inside one of the repositories. If so, we return the GitCommander repo
		// for that submodule.
		if (submodules) {
			for (var submodulePath in submodules) {
				var submoduleRegex = new RegExp("^" + submodulePath);
				if (submoduleRegex.test(filePath)) {
					repoUtil = this.tools[submodulePath];
				}
			}
		}

		return repoUtil;
	}

	removeSubmodulePrefix(filePath) {
		var submodules = this.repo.submodules;
		if (submodules) {
			for (var submodulePath in submodules) {
				var submoduleRegex = new RegExp("^" + submodulePath);
				if (submoduleRegex.test(filePath)) {
					filePath = filePath.replace(submoduleRegex, "");
				}
			}
		}

		// remove leading '/' if there is one before returning
		filePath = filePath.replace(/^\//, "");
		return filePath;
	}
}
