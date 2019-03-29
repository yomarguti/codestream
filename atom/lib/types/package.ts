import { ViewsState } from "views/controller";
import { EnvironmentConfig } from "../env-utils";
import { Session } from "../workspace/workspace-session";

export interface InMemorySettings {
	viewCodemarksInline: boolean;
}

export interface PackageState {
	session?: Session;
	lastUsedEmail?: string;
	environment?: EnvironmentConfig;
	views?: ViewsState;
	inMemorySettings?: InMemorySettings;
}
