import { Session } from "../workspace/workspace-session";
import { EnvironmentConfig } from "../env-utils";

export interface PackageState {
	session?: Session;
	lastUsedEmail?: string;
	environment?: EnvironmentConfig;
}
