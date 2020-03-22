import {
	GetFileScmInfoRequestType,
	GetFileScmInfoResponse,
	GetRepoScmStatusRequestType,
	GetRepoScmStatusResponse,
	GetReposScmRequestType,
	FileStatus,
	AddIgnoreFilesRequestType,
	IgnoreFilesRequestType,
	ReposScm,
	DidChangeDataNotificationType,
	ChangeDataType
} from "@codestream/protocols/agent";
import {
	CSDirectStream,
	CSReview,
	CSStream,
	CSUser,
	StreamType,
	CSMe
} from "@codestream/protocols/api";
import React, { ReactElement } from "react";
import { connect } from "react-redux";
import cx from "classnames";
import {
	getStreamForId,
	getStreamForTeam,
	getDirectMessageStreamsForTeam,
	getDMName
} from "../store/streams/reducer";
import { mapFilter, toMapBy, replaceHtml, keyFilter, safe, arrayDiff } from "../utils";
import { HostApi } from "../webview-api";
import Button from "./Button";
import Tag from "./Tag";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import { sortBy as _sortBy, sortBy } from "lodash-es";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import HeadshotMenu from "@codestream/webview/src/components/HeadshotMenu";
import { SelectPeople } from "@codestream/webview/src/components/SelectPeople";
import { getTeamMembers, getTeamTagsArray, getTeamMates } from "../store/users/reducer";
import MessageInput from "./MessageInput";
import { openPanel, closePanel, createPostAndReview, setUserPreference } from "./actions";
import { CodeStreamState } from "../store";
import { CSText } from "../src/components/CSText";
import { SharingControls, SharingAttributes } from "./SharingControls";
import { SmartFormattedList } from "./SmartFormattedList";
import { confirmPopup } from "./Confirm";
import { markdownify } from "./Markdowner";
import { EditorRevealRangeRequestType } from "../ipc/host.protocol.editor";
import { Range } from "vscode-languageserver-types";
import { PostsActionsType } from "../store/posts/types";
import { URI } from "vscode-uri";
import { logError } from "../logger";
import { DocumentData } from "../protocols/agent/agent.protocol.notifications";
import { InlineMenu } from "../src/components/controls/InlineMenu";
import { LoadingMessage } from "../src/components/LoadingMessage";
import { editReview, EditableAttributes } from "../store/reviews/actions";
import { Modal } from "./Modal";
import { FeatureFlag } from "./FeatureFlag";
import Timestamp from "./Timestamp";
import { ReviewShowLocalDiffRequestType, WebviewPanels } from "@codestream/protocols/webview";
import { Checkbox } from "../src/components/Checkbox";

interface Props extends ConnectedProps {
	editingReview?: CSReview;
	isEditing?: boolean;
	onClose?: Function;
	openPanel: Function;
	closePanel: Function;
	setUserPreference: Function;
}

interface ConnectedProps {
	teamMates: CSUser[];
	teamMembers: CSUser[];
	directMessageStreams: CSDirectStream[];
	channel: CSStream;
	providerInfo: {
		[service: string]: {};
	};
	currentUser: CSUser;
	skipPostCreationModal: boolean;
	selectedStreams: {};
	showChannels: string;
	teamTagsArray: any;
	textEditorUri?: string;
	createPostAndReview?: Function;
	editReview?: Function;
	repos: any;
	shouldShare: boolean;
	unsavedFiles: string[];
}

interface State {
	title: string;
	titleTouched: boolean;
	text: string;
	assignees: { value: any; label: string }[] | { value: any; label: string };
	assigneesRequired: boolean;
	assigneesDisabled: boolean;
	singleAssignee: boolean;
	reviewers: CSUser[];
	reviewersTouched: boolean;
	authorsById: { [authorId: string]: { stomped: number; commits: number } };
	notify: boolean;
	isLoading: boolean;
	isLoadingScm: boolean;
	reviewCreationError: string;
	scmError: boolean;
	crossPostMessage: boolean;
	assignableUsers: { value: any; label: string }[];
	channelMenuOpen: boolean;
	channelMenuTarget: any;
	labelMenuOpen: boolean;
	labelMenuTarget: any;
	fromCommitMenuOpen: boolean;
	fromCommitMenuTarget: any;
	sharingDisabled?: boolean;
	selectedChannelName?: string;
	selectedChannelId?: string;
	codeBlockInvalid?: boolean;
	titleInvalid?: boolean;
	textInvalid?: boolean;
	reviewersInvalid?: boolean;
	assigneesInvalid?: boolean;
	sharingAttributesInvalid?: boolean;
	showAllChannels?: boolean;
	scmInfo: GetFileScmInfoResponse;
	repoUri?: string;
	selectedTags?: any;
	repoStatus: GetRepoScmStatusResponse;
	openRepos: ReposScm[];
	repoName: string;
	excludedFiles?: any;
	fromCommit?: string;
	includeSaved: boolean;
	includeStaged: boolean;
	excludeCommit: { [sha: string]: boolean };
	startCommit: string;
	unsavedFiles: string[];
	ignoredFiles: {
		[file: string]: boolean;
	};
	commitListLength: number;
}

function merge(defaults: Partial<State>, review: CSReview): State {
	return Object.entries(defaults).reduce((object, entry) => {
		const [key, value] = entry;
		object[key] = review[key] !== undefined ? review[key] : value;
		return object;
	}, Object.create(null));
}

class ReviewForm extends React.Component<Props, State> {
	static defaultProps = {
		isEditing: false
	};
	_titleInput: HTMLElement | null = null;
	insertTextAtCursor?: Function;
	focusOnMessageInput?: Function;
	permalinkRef = React.createRef<HTMLTextAreaElement>();
	private _sharingAttributes?: SharingAttributes;
	private disposables: { dispose(): void }[] = [];

	constructor(props: Props) {
		super(props);
		const defaultState: Partial<State> = {
			title: "",
			titleTouched: false,
			text: "",
			assignees: [],
			assigneesDisabled: false,
			assigneesRequired: false,
			singleAssignee: false,
			selectedChannelName: (props.channel as any).name,
			selectedChannelId: props.channel.id,
			assignableUsers: this.getAssignableCSUsers(),
			reviewers: [],
			reviewersTouched: false,
			authorsById: {},
			selectedTags: {},
			repoName: "",
			excludedFiles: {},
			ignoredFiles: {},
			includeSaved: true,
			includeStaged: true,
			excludeCommit: {},
			startCommit: "",
			unsavedFiles: props.unsavedFiles,
			commitListLength: 10
		};

		const state = props.editingReview
			? merge(defaultState, props.editingReview)
			: ({
					isLoading: false,
					isLoadingScm: false,
					scmError: false,
					notify: false,
					...defaultState
			  } as State);

		let assignees: any;
		if (props.isEditing && props.editingReview) {
			assignees = props.editingReview.reviewers.map(a =>
				state.assignableUsers.find((au: any) => au.value === a)
			);
			state.reviewers = props.editingReview.reviewers
				.map(id => props.teamMembers.find(p => p.id === id))
				.filter(Boolean) as CSUser[];
		} else if (state.assignees === undefined) {
			assignees = undefined;
		} else if (Array.isArray(state.assignees)) {
			assignees = state.assignees.map(a => state.assignableUsers.find((au: any) => au.value === a));
		} else {
			assignees = state.assignableUsers.find((au: any) => au.value === state.assignees);
		}
		this.state = {
			...state,
			assignees
		};

		if (props.isEditing && props.editingReview) {
			const selectedTags = {};
			(props.editingReview.tags || []).forEach(tag => {
				selectedTags[tag] = true;
			});
			this.state = {
				...this.state,
				selectedTags
			};
		}
	}

	private async getScmInfoForURI(uri: string, callback?: Function) {
		this.setState({ isLoadingScm: true });

		const openRepos = await HostApi.instance.send(GetReposScmRequestType, {});
		if (openRepos && openRepos.repositories) this.setState({ openRepos: openRepos.repositories });

		const scmInfo = await HostApi.instance.send(GetFileScmInfoRequestType, {
			uri: uri
		});
		if (scmInfo.scm) {
			const repoId: string = scmInfo.scm.repoId || "";
			const repoName = this.props.repos[repoId] ? this.props.repos[repoId].name : "";
			this.setState({ scmInfo, repoName, startCommit: "" }, () => {
				this.handleRepoChange(uri);
				if (callback) callback();
			});
		} else {
			this.setState({ isLoadingScm: false, scmError: true });
		}
	}

	componentDidMount() {
		const { isEditing, textEditorUri } = this.props;
		if (isEditing) return;

		if (textEditorUri) this.getScmInfoForURI(textEditorUri);

		this.disposables.push(
			HostApi.instance.on(DidChangeDataNotificationType, (e: any) => {
				// if we have a change to scm OR a file has been saved, update
				if (
					e.type === ChangeDataType.Commits ||
					(e.type === ChangeDataType.Documents &&
						e.data &&
						(e.data as DocumentData).reason === "saved")
				) {
					if (!this.state.scmError) {
						// if there is an error getting git info,
						// don't bother attempting since it's an error

						this.setState({ isLoadingScm: true });
						// handle the repo change, but don't pass the textEditorUri
						// as we don't want to switch the repo the form is pointing
						// to in these cases
						this.handleRepoChange();
					}
				}
			})
		);

		this.focus();
	}

	componentWillUnmount = () => {
		this.disposables.forEach(d => d.dispose());
	};

	async handleRepoChange(repoUri?) {
		const { teamMates, currentUser } = this.props;
		const { includeSaved, includeStaged, startCommit } = this.state;

		const uri = repoUri || this.state.repoUri;
		const statusInfo = await HostApi.instance.send(GetRepoScmStatusRequestType, {
			uri,
			startCommit,
			includeStaged,
			includeSaved,
			currentUserEmail: currentUser.email
		});
		this.setState({ repoStatus: statusInfo, repoUri: uri });
		if (!startCommit && statusInfo.scm && statusInfo.scm.startCommit) {
			this.setChangeStart(statusInfo.scm.startCommit);

			if (statusInfo.scm.commits) {
				const commitListLength = statusInfo.scm.commits.findIndex(
					// @ts-ignore
					commit => commit.info.email !== currentUser.email
				);
				if (commitListLength >= 0) this.setState({ commitListLength });
			}
		}

		if (statusInfo.scm) {
			const authors = statusInfo.scm.authors;
			const authorsById = {};
			authors.map(author => {
				const user = teamMates.find(t => t.email == author.email);
				if (user) authorsById[user.id] = author;
			});
			this.setState({ authorsById });

			if (!this.state.reviewersTouched) {
				const reviewers = Object.keys(authorsById)
					// get the top 2 most impacted authors
					// based on how many times their code
					// was stomped on, and make those
					// "suggested reviewers"
					.sort(
						(a, b) =>
							authorsById[b].commits * 10 +
							authorsById[b].stomped -
							(authorsById[a].commits * 10 + authorsById[a].stomped)
					)
					.map(id => teamMates.find(p => p.id === id))
					.filter(Boolean)
					.slice(0, 2);
				// @ts-ignore
				this.setState({ reviewers });
			}

			// if there is no title set, default it to a capitalized version
			// of the branch name, with "feature/foo-bar" changed to
			// "feature: foo bar"
			if (statusInfo.scm.branch && !this.state.title) {
				const { branch } = statusInfo.scm;
				this.setState({
					title:
						branch.charAt(0).toUpperCase() +
						branch
							.slice(1)
							.replace("-", " ")
							.replace(/^(\w+)\//, "$1: ")
				});
			}

			const { excludedFiles } = this.state;
			// default any files which are `new` to be excluded from the review
			// but only those which haven't been explicitly set to true or false
			statusInfo.scm.modifiedFiles.forEach(f => {
				if (f.status === FileStatus.untracked && excludedFiles[f.file] === undefined)
					this.setState(state => ({ excludedFiles: { ...state.excludedFiles, [f.file]: true } }));
			});

			const response = await HostApi.instance.send(IgnoreFilesRequestType, {
				repoPath: statusInfo.scm.repoPath
			});
			if (response && response.paths) {
				const ignoredFiles = {};
				response.paths.forEach(path => (ignoredFiles[path] = true));
				this.setState({ ignoredFiles });
			}
		} else {
			this.setState({ isLoadingScm: false, scmError: true });
			return;
		}
		this.setState({ isLoadingScm: false, scmError: false });
	}

	async addIgnoreFile(filename: string) {
		const { scm } = this.state.scmInfo;
		if (!scm) return;
		const { repoPath } = scm;

		return await HostApi.instance.send(AddIgnoreFilesRequestType, { repoPath, path: filename });
	}

	focus = () => {
		this._titleInput && this._titleInput.focus();
	};

	toggleNotify = () => {
		this.setState({ notify: !this.state.notify });
	};

	getAssignableCSUsers() {
		return mapFilter(this.props.teamMembers, user => {
			if (!user.isRegistered) return;
			return {
				value: user.id,
				label: user.username
			};
		});
	}

	handleClickSubmit = async (event?: React.SyntheticEvent) => {
		event && event.preventDefault();
		if (this.state.isLoading) return;
		if (this.isFormInvalid()) return;
		this.setState({ isLoading: true });

		const { title, text, selectedChannelId, selectedTags, repoStatus, authorsById } = this.state;
		const { startCommit, excludeCommit, excludedFiles, includeSaved, includeStaged } = this.state;

		const reviewerIds = (this.state.reviewers as any[]).map(r => r.id);

		try {
			if (this.props.isEditing && this.props.editReview && this.props.editingReview) {
				const originalReviewers = this.props.editingReview.reviewers;
				const attributes: EditableAttributes = {
					title: title,
					text: text
				};
				const reviewerOperations = arrayDiff(originalReviewers, reviewerIds);
				if (reviewerOperations) {
					if (reviewerOperations.added && reviewerOperations.added.length) {
						attributes.$push = attributes.$push || {};
						attributes.$push.reviewers = reviewerOperations.added;
					}
					if (reviewerOperations.removed && reviewerOperations.removed.length) {
						attributes.$pull = attributes.$pull || {};
						attributes.$pull.reviewers = reviewerOperations.removed;
					}
				}
				const tagOperations = arrayDiff(this.props.editingReview.tags, keyFilter(selectedTags));
				if (tagOperations) {
					if (tagOperations.added && tagOperations.added.length) {
						attributes.$push = attributes.$push || {};
						attributes.$push.tags = tagOperations.added;
					}
					if (tagOperations.removed && tagOperations.removed.length) {
						attributes.$pull = attributes.$pull || {};
						attributes.$pull.tags = tagOperations.removed;
					}
				}

				const editResult = await this.props.editReview(this.props.editingReview.id, attributes);
				if (editResult && editResult.review) {
					if (this.props.onClose) {
						this.props.onClose();
					}
				}
			} else if (this.props.createPostAndReview) {
				let scm;
				if (repoStatus) {
					scm = repoStatus.scm;
				}
				const hasSavedFiles = scm ? scm.savedFiles.length > 0 : false;
				const hasStagedFiles = scm ? scm.stagedFiles.length > 0 : false;

				let review = {
					title,
					sharingAttributes: this.props.shouldShare ? this._sharingAttributes : undefined,
					text: replaceHtml(text)!,
					reviewers: reviewerIds,
					authorsById,
					tags: keyFilter(selectedTags),
					status: "open",
					repoChanges: [
						{
							scm: scm,
							startCommit,
							excludeCommit,
							excludedFiles: keyFilter(excludedFiles),
							includeSaved: hasSavedFiles,
							includeStaged: hasStagedFiles
						}
					]
				} as any;
				const { type: createResult } = await this.props.createPostAndReview(review);
				if (createResult !== PostsActionsType.FailPendingPost) {
					if (this.props.skipPostCreationModal) {
						this.props.closePanel();
					} else {
						confirmPopup({
							title: "Review Submitted",
							closeOnClickA: true,
							message: (
								<div>
									You can see the review in your{" "}
									<a onClick={() => this.props.openPanel(WebviewPanels.Activity)}>activity feed</a>.
									<br />
									<br />
									<div
										style={{
											textAlign: "left",
											fontSize: "12px",
											display: "inline-block",
											margin: "0 auto"
										}}
									>
										<Checkbox
											name="skipPostCreationModal"
											onChange={() => {
												this.props.setUserPreference(
													["skipPostCreationModal"],
													!this.props.skipPostCreationModal
												);
											}}
										>
											Don't show this again
										</Checkbox>
									</div>
								</div>
							),
							centered: true,
							buttons: [
								{
									label: "OK",
									action: () => this.props.closePanel()
								}
							]
						});
					}
				}
			}
		} catch (error) {
			logError(error, {
				isEditing: this.props.isEditing
			});
			this.setState({ reviewCreationError: error.message, isLoading: false });
		} finally {
			this.setState({ isLoading: false });
		}
	};

	isFormInvalid = () => {
		const { text, title, reviewers } = this.state;

		const validationState: Partial<State> = {
			titleInvalid: false,
			textInvalid: false,
			reviewersInvalid: false,
			sharingAttributesInvalid: false
		};

		let invalid = false;
		if (title.length === 0) {
			validationState.titleInvalid = true;
			invalid = true;
		}

		this.setState(validationState as State);
		return invalid;
	};

	renderTitleHelp = () => {
		const { titleInvalid } = this.state;

		if (titleInvalid) return <small className="error-message">Required</small>;
		else return null;
	};

	renderTextHelp = () => {
		const { textInvalid } = this.state;

		if (textInvalid) return <small className="error-message">Required</small>;
		else return null;
	};

	switchChannel = (event: React.SyntheticEvent) => {
		if (this.props.isEditing) return;

		event.stopPropagation();
		if (!this.state.channelMenuOpen) {
			const target = event.target;
			this.setState(state => ({
				channelMenuOpen: !state.channelMenuOpen,
				channelMenuTarget: target,
				crossPostMessage: true
			}));
		}
	};

	selectChannel = (stream: CSStream | "show-all") => {
		if (stream === "show-all") {
			this.setState({ showAllChannels: true });
			return;
		} else if (stream && stream.id) {
			const channelName = (stream.type === StreamType.Direct ? "@" : "#") + (stream as any).name;
			this.setState({ selectedChannelName: channelName, selectedChannelId: stream.id });
		}
		this.setState({ channelMenuOpen: false });
		this.focus();
	};

	switchLabel = (event: React.SyntheticEvent) => {
		event.stopPropagation();
		const target = event.target;
		this.setState(state => ({
			labelMenuOpen: !state.labelMenuOpen,
			labelMenuTarget: target
		}));
	};

	renderTags = () => {
		const { selectedTags } = this.state;
		const keys = Object.keys(selectedTags);
		if (keys.length === 0) return null;

		return (
			<div className="related">
				<div className="related-label">Tags</div>
				<div style={{ marginBottom: "-5px" }}>
					{this.props.teamTagsArray.map(tag => {
						return selectedTags[tag.id] ? <Tag tag={tag} /> : null;
					})}
					<div style={{ clear: "both" }} />
				</div>
			</div>
		);
	};

	renderSharingControls = () => {
		if (this.props.isEditing) return null;

		const repoId =
			this.state.repoStatus && this.state.repoStatus.scm ? this.state.repoStatus.scm.repoId : "";
		return (
			<div className="checkbox-row" style={{ float: "left" }}>
				<SharingControls
					showToggle
					onChangeValues={values => {
						this._sharingAttributes = values;
					}}
					repoId={repoId}
				/>
			</div>
		);
	};

	handleChange = text => {
		// track newPostText as the user types
		this.setState({ text });
	};

	handleToggleTag = tagId => {
		if (!tagId) return;
		let selectedTags = this.state.selectedTags;
		selectedTags[tagId] = !selectedTags[tagId];
		this.setState({ selectedTags });
	};

	renderMessageInput = () => {
		const { text } = this.state;

		const __onDidRender = ({ insertTextAtCursor, focus }) => {
			this.insertTextAtCursor = insertTextAtCursor;
			this.focusOnMessageInput = focus;
		};

		return (
			<MessageInput
				teamProvider={"codestream"}
				isDirectMessage={this.props.channel.type === StreamType.Direct}
				text={text.replace(/\n/g, "<br/>")}
				placeholder="Description (Optional)"
				multiCompose
				withTags
				onChange={this.handleChange}
				toggleTag={this.handleToggleTag}
				shouldShowRelatableCodemark={codemark =>
					this.props.editingReview ? codemark.id !== this.props.editingReview.id : true
				}
				onDismiss={this.confirmCancel}
				onSubmit={this.handleClickSubmit}
				selectedTags={this.state.selectedTags}
				__onDidRender={__onDidRender}
			/>
		);
	};

	render() {
		const { repoStatus } = this.state;
		const totalModifiedLines = repoStatus && repoStatus.scm ? repoStatus.scm.totalModifiedLines : 0;

		return (
			<FeatureFlag flag="lightningCodeReviews">
				{isOn => {
					if (!isOn) {
						return (
							<Modal verticallyCenter={true} onClose={() => this.props.closePanel()}>
								<p>
									This functionality is available on a limited basis to beta customers.
									<br />
									<br />
									Contact <a href="mailto:sales@codestream.com">sales@codestream.com</a> to schedule
									a demo.
								</p>
							</Modal>
						);
					}

					return (
						<div className="full-height-codemark-form">
							<span className="plane-container">
								<div className="codemark-form-container">{this.renderReviewForm()}</div>
								{this.renderExcludedFiles()}
								<div style={{ height: "5px" }}></div>
								{!this.props.isEditing && this.state.reviewers.length > 0 && (
									<>
										<div style={{ height: "10px" }}></div>
										<CSText muted>
											<SmartFormattedList value={this.state.reviewers.map(m => m.email)} /> will be
											notified via email
										</CSText>
									</>
								)}
								{!this.props.isEditing && totalModifiedLines > 100 && (
									<div style={{ display: "flex", padding: "10px 0 0 2px" }}>
										<Icon name="alert" muted />
										<span style={{ paddingLeft: "10px" }}>
											<CSText as="span" muted>
												There are {totalModifiedLines.toLocaleString()} total modified lines in this
												review, which is a lot to digest. Increase your development velocity with{" "}
												<a href="https://www.codestream.com/blog/reviewing-the-code-review-part-i">
													shift left code reviews
												</a>
												.
											</CSText>
										</span>
									</div>
								)}
								{!this.props.isEditing && (
									<>
										<div style={{ height: "10px" }}></div>
										<CSText muted>
											CodeStream's lightweight code reviews let you request a review on the current
											state of your repo, without the friction of save, branch, commit, push, create
											PR, email, pull, web, email, web. Comments on your review are saved with the
											code even once merged in.
										</CSText>
									</>
								)}
							</span>
						</div>
					);
				}}
			</FeatureFlag>
		);
	}

	confirmCancel = () => {
		const { titleTouched, text, reviewersTouched } = this.state;

		// if the user has made any changes in the form, confirm before closing
		if (titleTouched || text.length || reviewersTouched) {
			confirmPopup({
				title: "Are you sure?",
				message: "Changes you made will not be saved.",
				centered: true,
				buttons: [
					{ label: "Go Back", className: "control-button" },
					{
						label: this.props.isEditing ? "Discard Edits" : "Discard Review",
						wait: true,
						action: () => {
							const isEditing = this.props.isEditing;
							this.props.onClose && this.props.onClose();
							if (!isEditing) {
								this.props.closePanel();
							}
						},
						className: "delete"
					}
				]
			});
		} else {
			this.props.closePanel();
		}
	};

	exclude = (event: React.SyntheticEvent, file: string) => {
		const { excludedFiles } = this.state;
		event.stopPropagation();
		this.setState({ excludedFiles: { ...excludedFiles, [file]: !excludedFiles[file] } });
	};

	excluded = (file: string) => {
		return this.state.excludedFiles[file] || this.state.ignoredFiles[file];
	};

	excludeFuture = (event: React.SyntheticEvent, file: string) => {
		const { repoStatus } = this.state;
		if (!repoStatus) return null;
		const { scm } = repoStatus;
		if (!scm) return null;

		event.stopPropagation();

		const ignoreFile = scm.repoPath + "/.codestreamignore";
		const success = this.addIgnoreFile(file);
		if (success) {
			this.exclude(event, file);
			this.setState({ ignoredFiles: { ...this.state.ignoredFiles, [file]: true } });
			confirmPopup({
				title: "Exclude Files",
				message: (
					<div style={{ wordBreak: "break-word", fontSize: "12px" }}>
						<span className="monospace highlight bold">{file}</span>{" "}
						<span className="subtle">has been added to the CodeStream ignore file </span>
						<span className="monospace highlight bold">{ignoreFile}</span>
					</div>
				),
				centered: true,
				buttons: [
					{ label: "OK", className: "control-button" },
					{
						label: "Open Ignore File",
						className: "cancel",
						action: () => {
							HostApi.instance.send(EditorRevealRangeRequestType, {
								uri: "file://" + ignoreFile,
								range: Range.create(0, 0, 0, 0),
								atTop: true,
								preserveFocus: true
							});
						}
					}
				]
			});
		} else {
			confirmPopup({
				title: "Ooops",
				message: (
					<>
						<span className="subtle">There was a problem adding </span>
						<span className="monospace highlight bold">{file}</span>{" "}
						<span className="subtle"> to the CodeStream ignore file </span>
						<span className="monospace highlight bold">{ignoreFile}</span>
					</>
				)
			});
		}
		return null;
	};

	changeScmState = settings => {
		this.setState({ ...settings }, () => this.handleRepoChange());
	};

	handleClickChangeStart = (event: React.SyntheticEvent, sha: string) => {
		const target = event.target as HTMLElement;
		if (target.tagName === "A") return;
		this.setChangeStart(sha, () => this.handleRepoChange());
	};

	setChangeStart = (sha: string, callback?) => {
		const { scm } = this.state.repoStatus;
		if (!scm) return;
		const { commits } = scm;
		if (!commits) return;

		// are we turning it on, or turning it off? checkbox=true means we're including
		const exclude = !this.state.excludeCommit[sha];

		const excludeCommit: { [sha: string]: boolean } = {};
		let newValue = false;
		let startCommit = "";
		commits.forEach((commit, index) => {
			// turning it on
			if (exclude) {
				if (commit.sha === sha) {
					// this one, plus all others after will be excluded
					newValue = true;

					// the commit to diff against is this one, since
					// we don't want to include this (or any prior)
					// in the review
					startCommit = sha;
				}
				excludeCommit[commit.sha] = newValue;
			}
			// turning it off
			else {
				excludeCommit[commit.sha] = newValue;
				if (commit.sha === sha) {
					// all others after this will be excluded
					newValue = true;
					// start commit is the parent of this one
					if (commits[index + 1]) startCommit = commits[index + 1].sha;
					else startCommit = commit.sha + "^";
				}
			}
		});

		this.setState({ startCommit, excludeCommit }, callback);
	};

	toggleSaved = () => {
		if (this.state.includeSaved) {
			this.changeScmState({ includeSaved: false, includeStaged: true });
		} else {
			this.changeScmState({ includeSaved: true, includeStaged: true });
		}
	};

	toggleStaged = () => {
		if (this.state.includeStaged) {
			this.changeScmState({ includeSaved: false, includeStaged: false });
		} else {
			this.changeScmState({ includeSaved: false, includeStaged: true });
		}
	};

	renderChange(
		id: string,
		onOff: boolean,
		headshot: ReactElement,
		title: string,
		message: string | ReactElement,
		onClick,
		tooltip?: string | ReactElement
	) {
		return (
			<Tooltip title={tooltip || ""} placement="top" delay={1}>
				<div
					className={`row-with-icon-actions ${onOff ? "" : "muted"}`}
					style={{ display: "flex", alignItems: "center" }}
					key={id}
					onClick={onClick}
				>
					<input type="checkbox" checked={onOff} style={{ flexShrink: 0, pointerEvents: "none" }} />
					<label className="ellipsis-right-container no-margin" style={{ cursor: "pointer" }}>
						{/* headshot */}
						<span
							dangerouslySetInnerHTML={{
								__html: markdownify(title)
							}}
						/>
					</label>
					<span
						className="message"
						style={{ textAlign: "right", flexGrow: 10, whiteSpace: "nowrap" }}
					>
						{message}
					</span>
					<span />
				</div>
			</Tooltip>
		);
	}

	// pluralize the label: "2 files" vs. "1 file"
	// and provide a tooltip listing the files
	fileListLabel = (files: string[]) => {
		const fileLabel = files.length === 1 ? "file" : "files";
		return `${files.length} ${fileLabel}`;
	};

	fileListTip = (files: string[]) => {
		return (
			<>
				{files.map(file => (
					<div>{file}</div>
				))}
			</>
		);
	};

	authorHeadshot = commit => {
		const { teamMembers } = this.props;
		const author = teamMembers.find(p => p.email === commit.info.email);
		if (author) return <Headshot person={author} size={20} display="inline-block" />;
		else return <></>;
	};

	renderGroupsAndCommits() {
		const { repoStatus, includeSaved, includeStaged, excludeCommit, commitListLength } = this.state;
		if (!repoStatus) return null;
		const { scm } = repoStatus;
		if (!scm) return null;
		const { commits = [] } = scm;

		const { unsavedFiles } = this.props;
		let unsavedFilesInThisRepo: string[] = [];

		if (scm.repoPath) {
			for (let path of unsavedFiles) {
				let uri = URI.parse(path);
				let uriPath = uri.path;
				if (uriPath[0] === "/") {
					uriPath = uriPath.substring(1);
				}
				if (uriPath.indexOf(scm.repoPath) === 0) {
					unsavedFilesInThisRepo.push(uriPath);
				}
			}
		}

		const numSavedFiles = scm.savedFiles.length;
		const numStagedFiles = scm.stagedFiles.length;

		const commitList = commits.slice(0, commitListLength);
		const howManyMore = commits.length - commitList.length;

		const localCommits = commitList.filter(commit => commit.localOnly);
		const remoteCommits = commitList.filter(commit => !commit.localOnly);

		return (
			<div className="related">
				{(numSavedFiles > 0 || numStagedFiles > 0) && (
					<div className="related-label">Changes to Include In Review</div>
				)}
				{unsavedFilesInThisRepo.length > 0 && (
					<div style={{ display: "flex", padding: "0 0 2px 2px" }}>
						<Icon name="alert" muted />
						<span style={{ paddingLeft: "10px" }}>
							You have unsaved changes. If you want to include any of those changes in this review,
							save them first.
						</span>
					</div>
				)}
				{numSavedFiles > 0 &&
					this.renderChange(
						"saved",
						includeSaved,
						<Headshot person={this.props.currentUser} size={20} display="inline-block" />,
						"Saved Changes (Working Tree)",
						this.fileListLabel(scm.savedFiles),
						() => this.toggleSaved(),
						this.fileListTip(scm.savedFiles)
					)}
				{numStagedFiles > 0 &&
					this.renderChange(
						"staged",
						includeStaged,
						<Headshot person={this.props.currentUser} size={20} display="inline-block" />,
						"Staged Changes (Index)",
						this.fileListLabel(scm.stagedFiles),
						() => this.toggleStaged(),
						this.fileListTip(scm.stagedFiles)
					)}
				{localCommits.length > 0 && (
					<>
						<div className="related-label">
							<br />
							Local Commits
						</div>
						{this.renderCommitList(localCommits, excludeCommit)}
					</>
				)}
				{remoteCommits.length > 0 && (
					<>
						<div className="related-label">
							<br />
							Pushed Commits
						</div>
						{this.renderCommitList(remoteCommits, excludeCommit)}
					</>
				)}
				{howManyMore > 0 && (
					<div
						style={{ marginTop: "5px", cursor: "pointer" }}
						onClick={e => this.setState({ commitListLength: this.state.commitListLength + 10 })}
					>
						Show More
					</div>
				)}
			</div>
		);
	}

	renderCommitList(commits, excludeCommit) {
		return commits.map(commit =>
			this.renderChange(
				commit.sha,
				!excludeCommit[commit.sha],
				<></>,
				// @ts-ignore
				commit.info.shortMessage,
				<span className="monospace">{commit.sha.substr(0, 8)}</span>,
				e => this.handleClickChangeStart(e, commit.sha),
				<div style={{ maxWidth: "65vw" }}>
					{this.authorHeadshot(commit)}
					{commit.info && <b>{commit.info.author}</b>}
					{commit.info && commit.info.authorDate && (
						<Timestamp relative={true} time={new Date(commit.info.authorDate).getTime()} />
					)}
					<div style={{ paddingTop: "10px" }}>{commit.info.shortMessage}</div>
				</div>
			)
		);
	}

	showLocalDiff(path) {
		const { repoStatus, includeSaved, includeStaged, startCommit } = this.state;
		if (!repoStatus) return;
		const repoId = repoStatus.scm ? repoStatus.scm.repoId : "";
		if (!repoId) return;
		HostApi.instance.send(ReviewShowLocalDiffRequestType, {
			path,
			repoId,
			includeSaved,
			includeStaged,
			baseSha: startCommit
		});
	}

	renderFile(fileObject) {
		const { file, linesAdded, linesRemoved, status } = fileObject;
		// https://davidwalsh.name/rtl-punctuation
		// ellipsis-left has direction: rtl so that the ellipsis
		// go on the left side, but without the <bdi> component
		// the punctuation would be messed up (such as filenames
		// beginning with a period)
		return (
			<div
				className="row-with-icon-actions monospace ellipsis-left-container"
				onClick={() => this.showLocalDiff(file)}
			>
				<span className="file-info ellipsis-left">
					<bdi dir="ltr">{file}</bdi>
				</span>
				{linesAdded > 0 && <span className="added">+{linesAdded} </span>}
				{linesRemoved > 0 && <span className="deleted">-{linesRemoved}</span>}
				{status === FileStatus.untracked && <span className="added">new </span>}
				{status === FileStatus.added && <span className="added">added </span>}
				{status === FileStatus.copied && <span className="added">copied </span>}
				{status === FileStatus.unmerged && <span className="deleted">conflict </span>}
				{status === FileStatus.deleted && <span className="deleted">deleted </span>}
				{this.excluded(file) ? (
					<span className="actions">
						<Icon
							name="plus"
							title="Add back to review"
							placement="bottom"
							className="clickable action"
							onClick={e => this.exclude(e, file)}
						/>
						<Icon
							name="trashcan"
							title="Exclude from future reviews"
							placement="bottom"
							className="clickable action"
							onClick={e => this.excludeFuture(e, file)}
						/>
					</span>
				) : (
					<span className="actions">
						<Icon
							name="x"
							title="Exclude from review"
							className="clickable action"
							onClick={e => this.exclude(e, file)}
						/>
					</span>
				)}
			</div>
		);
	}

	nothingToReview() {
		return <div className="no-matches">No changes found or selected on this branch.</div>;
	}

	noScm() {
		return <div className="no-matches">No repo or changes found.</div>;
	}

	renderChangedFiles() {
		const { repoStatus } = this.state;
		let scm;

		let changedFiles = <></>;
		if (repoStatus) {
			scm = repoStatus.scm;
			if (scm) {
				const { modifiedFiles } = scm;
				const modified = modifiedFiles.filter(f => !this.excluded(f.file));
				if (modified.length === 0) return this.nothingToReview();
				changedFiles = <>{modified.map(file => this.renderFile(file))}</>;
			}
		}
		if (!scm) {
			return this.noScm();
		}

		return [
			<div className="related" style={{ padding: "0", marginBottom: 0, position: "relative" }}>
				<div className="related-label">
					Changed Files&nbsp;&nbsp;
					{this.state.isLoadingScm && <Icon className="spin" name="sync" />}
				</div>
				{changedFiles}
			</div>
		];
	}

	renderExcludedFiles() {
		const { repoStatus, excludedFiles, ignoredFiles } = this.state;
		if (!repoStatus) return null;
		const { scm } = repoStatus;
		if (!scm) return null;
		const { modifiedFiles } = scm;
		const excluded = modifiedFiles.filter(f => excludedFiles[f.file] && !ignoredFiles[f.file]);
		if (excluded.length === 0) return null;

		return [
			<div className="related" style={{ padding: "0", marginBottom: 0, position: "relative" }}>
				<div className="related-label">Excluded from this Review</div>
				{excluded.map(file => this.renderFile(file))}
			</div>
		];
	}

	setFrom = (commit: string) => {};

	toggleReviewer = person => {
		const { reviewers } = this.state;

		if (reviewers.find(p => p.id === person.id)) {
			this.setState({ reviewers: [...reviewers.filter(p => p.id !== person.id)] });
		} else {
			this.setState({ reviewers: [...reviewers, person].filter(Boolean) });
		}

		this.setState({ reviewersTouched: true });
	};

	removeReviewer = person => {
		const { reviewers } = this.state;
		this.setState({ reviewers: [...reviewers.filter(p => p.id !== person.id)] });

		this.setState({ reviewersTouched: true });
	};

	setRepo = repo => {
		this.setState({ isLoadingScm: true, scmError: false });
		this.getScmInfoForURI(repo.folder.uri);
	};

	renderReviewForm() {
		const { isEditing, editingReview, currentUser, repos } = this.props;
		const {
			scmInfo,
			repoName,
			reviewers,
			authorsById,
			openRepos,
			isLoadingScm,
			scmError
		} = this.state;

		// coAuthorLabels are a mapping from teamMate ID to the # of edits represented in
		// the autors variable (number of times you stomped on their code), and the number
		// of commits they pushed to this branch
		const coAuthorLabels = {};
		Object.keys(authorsById).map(id => {
			const label: string[] = [];
			if (authorsById[id].stomped === 1) label.push("1 edit");
			else if (authorsById[id].stomped > 1) label.push(authorsById[id].stomped + " edits");
			if (authorsById[id].commits === 1) label.push("1 commit");
			else if (authorsById[id].commits > 1) label.push(authorsById[id].commits + " commits");
			coAuthorLabels[id] = label.join(", ");
		});

		const modifier = navigator.appVersion.includes("Macintosh") ? "⌘" : "Alt";

		const submitTip = (
			<span>
				{isEditing ? "Edit Review" : "Submit Review"}
				<span className="keybinding extra-pad">{modifier} ENTER</span>
			</span>
		);

		const cancelTip = (
			<span>
				{isEditing ? "Cancel Edit" : "Discard Review"}
				<span className="keybinding extra-pad">ESC</span>
			</span>
		);

		const repoMenu = openRepos
			? openRepos.map(repo => {
					const repoName = repo.id && repos[repo.id] && repos[repo.id].name;
					return {
						label: repoName || repo.folder.uri,
						key: repo.id,
						action: () => this.setRepo(repo)
					};
			  })
			: [];

		return [
			<form className="standard-form review-form" key="form">
				<fieldset className="form-body">
					<div id="controls" className="control-group" key="controls1">
						<div key="headshot" className="headline-flex">
							<div style={{ paddingRight: "7px" }}>
								<Headshot person={currentUser} />
							</div>
							<div style={{ marginTop: "-1px" }}>
								<b>{currentUser.username}</b>
								<span className="subhead">
									is {isEditing ? "editing" : "requesting"} a code review
									{repoMenu.length > 0 && <> in </>}
								</span>
								{repoMenu.length > 0 && (
									<InlineMenu items={repoMenu}>{repoName || "select a repo"}</InlineMenu>
								)}
								{scmInfo && scmInfo.scm && scmInfo.scm.branch && (
									<>
										<span className="subhead">on branch&nbsp;</span>
										<span className="channel-label" style={{ display: "inline-block" }}>
											{scmInfo.scm.branch}
										</span>
									</>
								)}
							</div>
						</div>
						<div key="title" className="control-group">
							{this.renderTitleHelp()}
							<input
								key="title-text"
								type="text"
								name="title"
								className="input-text control"
								tabIndex={0}
								value={this.state.title}
								onChange={e => this.setState({ title: e.target.value, titleTouched: true })}
								placeholder="Title"
								ref={ref => (this._titleInput = ref)}
							/>
						</div>
						{this.renderTextHelp()}
						{this.renderMessageInput()}
					</div>
					{this.renderTags()}
					{!isLoadingScm && !isEditing && !scmError && (
						<div
							className="related"
							style={{ padding: "0", marginBottom: 0, position: "relative" }}
						>
							<div className="related-label">
								{reviewers.length > 0 && !this.state.reviewersTouched && "Suggested "}Reviewers
							</div>
							{reviewers.map(person => {
								const menu = (
									<HeadshotMenu
										person={person}
										menuItems={[
											{
												label: "Remove from Review",
												action: () => this.removeReviewer(person)
											}
										]}
									/>
								);
								// # of times you stomped on their code
								if (coAuthorLabels[person.id]) {
									return (
										<Tooltip placement="bottom" title={coAuthorLabels[person.id]}>
											<span>{menu}</span>
										</Tooltip>
									);
								} else return menu;
							})}
							<SelectPeople
								title="Select Reviewers"
								value={reviewers}
								onChange={this.toggleReviewer}
								multiSelect={true}
								labelExtras={coAuthorLabels}
							>
								<span className="icon-button">
									<Icon
										name="plus"
										title="Specify who you want to review your code"
										placement="bottom"
									/>
								</span>
							</SelectPeople>
						</div>
					)}
					{!isLoadingScm && isEditing && !scmError && (
						<div
							className="related"
							style={{ padding: "0", marginBottom: 0, position: "relative" }}
						>
							<div className="related-label">
								{reviewers.length > 0 && !this.state.reviewersTouched}Reviewers
							</div>
							{reviewers.map(person => {
								const menu = (
									<HeadshotMenu
										person={person}
										menuItems={[
											{
												label: "Remove from Review",
												action: () => this.removeReviewer(person)
											}
										]}
									/>
								);
								return menu;
							})}
							<SelectPeople
								title="Select Reviewers"
								value={reviewers}
								onChange={this.toggleReviewer}
								multiSelect={true}
								labelExtras={coAuthorLabels}
							>
								<span className="icon-button">
									<Icon name="plus" title="Specify who you want to review your code" />
								</span>
							</SelectPeople>
						</div>
					)}
					{!isEditing && !isLoadingScm && !scmError && this.renderChangedFiles()}
					{!isEditing && !isLoadingScm && !scmError && this.renderGroupsAndCommits()}
					{!isEditing && !isLoadingScm && !scmError && this.renderSharingControls()}
					{!isLoadingScm && (
						<div
							key="buttons"
							className="button-group"
							style={{
								marginLeft: "10px",
								marginTop: "10px",
								float: "right",
								width: "auto",
								marginRight: 0
							}}
						>
							<Tooltip title={cancelTip} placement="bottom" delay={1}>
								<Button
									key="cancel"
									style={{
										paddingLeft: "10px",
										paddingRight: "10px",
										width: "auto"
									}}
									className="control-button cancel"
									type="submit"
									onClick={this.confirmCancel}
								>
									Cancel
								</Button>
							</Tooltip>
							{!scmError && (
								<Tooltip title={submitTip} placement="bottomRight" delay={1}>
									<Button
										key="submit"
										style={{
											paddingLeft: "10px",
											paddingRight: "10px",
											// fixed width to handle the isLoading case
											width: "80px",
											marginRight: 0
										}}
										className={cx("control-button", { cancel: !this.state.title })}
										type="submit"
										loading={this.state.isLoading}
										onClick={this.handleClickSubmit}
									>
										Submit
									</Button>
								</Tooltip>
							)}
						</div>
					)}
					{isLoadingScm && <LoadingMessage>Loading repo info...</LoadingMessage>}
					{this.state.scmError && (
						<div className="color-warning" style={{ display: "flex", padding: "10px 0" }}>
							<Icon name="alert" />
							<div style={{ paddingLeft: "10px" }}>
								Error loading git info.
								{repoMenu.length > 0 && <> Select a repo above.</>}
							</div>
						</div>
					)}
					<div key="clear" style={{ clear: "both" }} />
					{this.state.reviewCreationError && (
						<div className="color-warning" style={{ display: "flex", padding: "10px 0" }}>
							<Icon name="alert" />
							<div style={{ paddingLeft: "10px" }}>{this.state.reviewCreationError}</div>
						</div>
					)}
				</fieldset>
			</form>
		];
	}
}

const EMPTY_OBJECT = {};

const mapStateToProps = (state: CodeStreamState): ConnectedProps => {
	const { context, editorContext, users, session, preferences, repos, documents } = state;
	const user = users[session.userId!] as CSMe;
	const channel = context.currentStreamId
		? getStreamForId(state.streams, context.currentTeamId, context.currentStreamId) ||
		  getStreamForTeam(state.streams, context.currentTeamId)
		: getStreamForTeam(state.streams, context.currentTeamId);

	const teamMates = getTeamMates(state);
	const teamMembers = getTeamMembers(state);
	const teamTagsArray = getTeamTagsArray(state);

	const directMessageStreams: CSDirectStream[] = (
		getDirectMessageStreamsForTeam(state.streams, context.currentTeamId) || []
	).map(stream => ({
		...(stream as CSDirectStream),
		name: getDMName(stream, toMapBy("id", teamMates), session.userId)
	}));

	let unsavedFiles: string[] = [];
	if (documents) {
		unsavedFiles = Object.keys(documents).filter(uri => {
			return documents[uri].isDirty;
		});
	}

	const skipPostCreationModal = preferences ? preferences.skipPostCreationModal : false;

	return {
		unsavedFiles: unsavedFiles,
		shouldShare:
			safe(() => state.preferences[state.context.currentTeamId].shareCodemarkEnabled) || false,
		channel,
		teamMates,
		teamMembers,
		directMessageStreams: directMessageStreams,
		providerInfo: (user.providerInfo && user.providerInfo[context.currentTeamId]) || EMPTY_OBJECT,
		currentUser: user,
		skipPostCreationModal,
		selectedStreams: preferences.selectedStreams || EMPTY_OBJECT,
		showChannels: context.channelFilter,
		textEditorUri: editorContext.textEditorUri,
		teamTagsArray,
		repos
	};
};

const ConnectedReviewForm = connect(mapStateToProps, {
	openPanel,
	closePanel,
	createPostAndReview,
	editReview,
	setUserPreference
})(ReviewForm);

export { ConnectedReviewForm as ReviewForm };
