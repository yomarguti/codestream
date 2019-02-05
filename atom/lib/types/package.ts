import { Session } from "lib/workspace/workspace-session";
import { EnvironmentConfig } from "lib/env-utils";

export interface PackageState {
	session?: Session;
	lastUsedEmail?: string;
	environment?: EnvironmentConfig;
}
