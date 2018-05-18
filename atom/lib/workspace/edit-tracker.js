// @flow
import { CompositeDisposable, Directory, GitRepository, TextEditor } from "atom";
import git from "../git";
import { getStreamForRepoAndFile } from "../reducers/streams";
import * as http from "../network-request";
import type { Resource, Store } from "../types";

export default class EditTracker implements Resource {
	store: Store;
	subscriptions = new CompositeDisposable();
	observedEditors: Map<number, TextEditor> = new Map();
	repoDirectory: Directory;
	repo: GitRepository;

	constructor(store: Store) {
		this.store = store;
		const workingDirectory = store.getState().repoAttributes.workingDirectory;
		this.repoDirectory = new Directory(workingDirectory);
		atom.project.repositoryForDirectory(this.repoDirectory).then((repo: GitRepository) => {
			this.repo = repo;
			this.subscriptions.add(repo.onDidChangeStatuses(this.onGitChange));
			this.initialize();
		});
	}

	initialize() {
		this.subscriptions.add(
			atom.workspace.observeActiveTextEditor(async (editor: ?TextEditor) => {
				if (
					editor &&
					!this.observedEditors.has(editor.id) &&
					(await this.isPathInRepo(editor.getPath()))
				) {
					const id = editor.id;
					this.subscriptions.add(
						editor.onDidChangeModified(modified => this.onFileModified(editor, modified)),
						editor.onDidDestroy(() => this.observedEditors.delete(id))
					);
				}
			})
		);
	}

	async isPathInRepo(path: string): Promise<boolean> {
		try {
			return !!await git(["ls-files", path], { cwd: this.repoDirectory.getPath() });
		} catch (e) {
			return false;
		}
	}

	onGitChange = () => {
		this.markAsModified(
			atom.workspace
				.getTextEditors()
				.filter(editor => {
					return this.repo.isPathModified(editor.getPath()) || editor.isModified();
				})
				.map(editor => this.repo.relativize(editor.getPath()))
		);
	};

	onFileModified(editor: TextEditor, modified: boolean) {
		this.setModificationStatus(editor, modified || this.repo.isPathModified(editor.getPath()));
	}

	setModificationStatus(editor: TextEditor, isModified: boolean) {
		const { context, session, streams } = this.store.getState();
		const file = this.repo.relativize(editor.getPath());
		const fileStream = getStreamForRepoAndFile(streams, context.currentRepoId, file);
		let editing = isModified ? { commitHash: context.currentCommit } : false;

		let payload = {
			teamId: context.currentTeamId,
			repoId: context.currentRepoId,
			streamId: fileStream.id,
			file,
			editing
		};

		http.put("/editing", payload, session.accessToken);
	}

	markAsModified(paths: string[]) {
		const { context, session, streams } = this.store.getState();

		let modifiedPaths = [];
		let streamIds = [];
		paths.forEach(path => {
			const stream = getStreamForRepoAndFile(streams, context.currentRepoId, path);
			if (stream) streamIds.push(stream.id);
			else paths.push(path);
		});

		let payload = {
			teamId: context.currentTeamId,
			repoId: context.currentRepoId,
			editing: {
				commitHash: context.currentCommit
			},
			files: modifiedPaths || [],
			streamIds
		};

		http.put("/editing", payload, session.accessToken);
	}

	destroy() {
		this.subscriptions.dispose();
	}
}
