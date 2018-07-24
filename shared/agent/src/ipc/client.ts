"use strict";
import { RequestType0 } from "vscode-languageserver/lib/main";
import { GitApiRepository } from "../git/git";

export namespace GitRepositoriesRequest {
	export const type = new RequestType0<Promise<GitApiRepository[]>, void, void>(
		"codeStream/git/repos"
	);
}
