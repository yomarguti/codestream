"use strict";
import { Logger } from "../logger";
import { Strings } from "../system";
import { findGitPath } from "./locator";
import { CommandOptions, runCommand } from "./shell";

export const GitErrors = {
	badRevision: /bad revision \'.*?\'/i
};

export const GitWarnings = {
	notARepository: /Not a git repository/,
	outsideRepository: /is outside repository/,
	noPath: /no such path/,
	noCommits: /does not have any commits/,
	notFound: /Path \'.*?\' does not exist in/,
	foundButNotInRevision: /Path \'.*?\' exists on disk, but not in/,
	headNotABranch: /HEAD does not point to a branch/,
	noUpstream: /no upstream configured for branch \'(.*?)\'/,
	unknownRevision: /ambiguous argument \'.*?\': unknown revision or path not in the working tree/
};

// A map of running git commands -- avoids running duplicate overlaping commands
const pendingCommands: Map<string, Promise<string>> = new Map();

export async function git(
	options: CommandOptions & { readonly correlationKey?: string },
	...args: any[]
): Promise<string> {
	const start = process.hrtime();

	const { correlationKey, ...opts } = options;

	const encoding = options.encoding || "utf8";
	const runOpts = {
		...opts,
		encoding: encoding === "utf8" ? "utf8" : "binary",
		// Adds GCM environment variables to avoid any possible credential issues -- from https://github.com/Microsoft/vscode/issues/26573#issuecomment-338686581
		// Shouldn't *really* be needed but better safe than sorry
		env: {
			...(options.env || process.env),
			GCM_INTERACTIVE: "NEVER",
			GCM_PRESERVE_CREDS: "TRUE",
			LC_ALL: "C"
		}
	} as CommandOptions;

	const gitCommand = `git ${args.join(" ")}`;
	const command = `(${runOpts.cwd}${
		correlationKey !== undefined ? correlationKey : ""
	}): ${gitCommand}`;

	let promise = pendingCommands.get(command);
	if (promise === undefined) {
		Logger.log(`GIT: Running${command}`);
		// Fixes https://github.com/eamodio/vscode-gitlens/issues/73 & https://github.com/eamodio/vscode-gitlens/issues/161
		// See https://stackoverflow.com/questions/4144417/how-to-handle-asian-characters-in-file-names-in-git-on-os-x
		args.splice(0, 0, "-c", "core.quotepath=false", "-c", "color.ui=false");

		promise = runCommand(gitPath(), args, runOpts);

		pendingCommands.set(command, promise);
	} else {
		Logger.log(`GIT: Awaiting${command}`);
	}

	let data: string;
	try {
		data = await promise;
	} catch (ex) {
		const msg = ex && ex.toString();
		if (msg) {
			for (const warning of Object.values(GitWarnings)) {
				if (warning.test(msg)) {
					Logger.warn(
						"git",
						...args,
						`  cwd='${options.cwd}'\n\n  `,
						msg.replace(/\r?\n|\r/g, " ")
					);
					return "";
				}
			}
		}

		Logger.error(ex, "git", ...args, `  cwd='${options.cwd}'\n\n  `);
		throw ex;
	} finally {
		pendingCommands.delete(command);

		const completedIn = `in ${Strings.getDurationMilliseconds(start)} ms`;

		Logger.log(`GIT: Completed${command} ${completedIn}`);
		// Logger.logGitCommand(`${gitCommand} ${completedIn}`, runOpts.cwd!);
	}

	if (encoding === "utf8" || encoding === "binary") return data;

	// return iconv.decode(Buffer.from(data, 'binary'), encoding);
	return data;
}

let _gitPath = "git";
function gitPath(): string {
	return _gitPath;
}

export async function setGitPath(path: string): Promise<void> {
	_gitPath = await setOrFindGitPath(path);
}

async function setOrFindGitPath(gitPath?: string): Promise<string> {
	const start = process.hrtime();
	const gitInfo = await findGitPath(gitPath);

	Logger.log(
		`Git found: ${gitInfo.version} @ ${
			gitInfo.path === "git" ? "PATH" : gitInfo.path
		} \u2022 ${Strings.getDurationMilliseconds(start)} ms`
	);

	return gitInfo.path;
}
