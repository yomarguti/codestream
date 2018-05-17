// @flow
import type { Store as ReduxStore } from "redux";

export interface Resource {
	destroy(): void;
}

type State = {
	context: {
		currentRepoId: string,
		currentTeamId: string,
		currentCommit: string,
		currentFile: string
	},
	markerLocations: {
		byStream: {
			[string]: {
				[string]: {},
				uncommitted: []
			}
		}
	},
	repoAttributes: {
		workingDirectory: string
	},
	session: {
		accessToken: string,
		userId: string
	},
	streams: {
		byTeam: {
			[string]: {
				[string]: {}
			}
		}
	}
};
type Action = { type: string };
export type Store = ReduxStore<State, Action>;
