export default class ViewApi {
	constructor(workspaceSession) {
		this.workspaceSession = workspaceSession;
	}

	async authenticate(params) {
		await this.workspaceSession.login(params.email, params.password);
		const [streams, teams, users] = await Promise.all([
			this.workspaceSession.getStreams(),
			this.workspaceSession.getTeams(),
			this.workspaceSession.getUsers()
		]);
		return {
			currentTeamId: this.workspaceSession.getCurrentTeamId(),
			currentUserId: this.workspaceSession.getUserId(),
			unreads: { lastReads: {}, unread: {}, mentions: {} },
			streams,
			teams,
			users
		};
	}

	fetchPosts({ streamId, teamId }) {
		return this.workspaceSession.getPosts(streamId, teamId);
	}
}
