import { git } from "../git/git";
import { GetUserInfoRequestType, GetUserInfoResponse } from "../protocol/agent.protocol";
import { lsp, lspHandler } from "../system";
const os = require("os");

@lsp
export class UnauthenticatedScmManager {
	@lspHandler(GetUserInfoRequestType)
	async getUserInfo(): Promise<GetUserInfoResponse> {
		try {
			// since OSes have different requirements for characters in usernames,
			// i'd regex replace out any characters that are not ones that we allow
			// just to allow an even greater frictionless experience.
			// "canz man".replace(/[^A-Za-z0-9\-_\.]/g,'') => "canzman"
			const userInfo = os.userInfo();
			const username = userInfo.username.replace(/[^A-Za-z0-9\-_\.]/g, "").substring(0, 21);
			const email = await git({}, "config", "--get", "user.email");
			const name = await git({}, "config", "--get", "user.name");

			return { email: email.trim(), name: name.trim(), username };
		} catch {
			return { email: "", name: "", username: "" };
		}
	}
}
