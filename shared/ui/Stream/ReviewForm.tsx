import {
	FetchAssignableUsersRequestType,
	GetFileScmInfoRequestType,
	GetFileScmInfoResponse,
	GetRepoScmStatusRequestType,
	GetRepoScmStatusResponse
} from "@codestream/protocols/agent";
import {
	CSChannelStream,
	CSDirectStream,
	CSReview,
	CSStream,
	CSUser,
	StreamType,
	CSApiCapabilities,
	CSMe
} from "@codestream/protocols/api";
import React, { ReactElement } from "react";
import { connect } from "react-redux";
import {
	getStreamForId,
	getStreamForTeam,
	getChannelStreamsForTeam,
	getDirectMessageStreamsForTeam,
	getDMName
} from "../store/streams/reducer";
import { mapFilter, toMapBy, replaceHtml, keyFilter, safe } from "../utils";
import { HostApi } from "../webview-api";
import Button from "./Button";
import Tag from "./Tag";
import Icon from "./Icon";
import Menu from "./Menu";
import Tooltip from "./Tooltip";
import { sortBy as _sortBy, sortBy } from "lodash-es";
import Headshot from "./Headshot";
import { getTeamMembers, getTeamTagsArray, getTeamMates } from "../store/users/reducer";
import MessageInput from "./MessageInput";
import Select from "react-select";
import { closePanel } from "./actions";
import { CodeStreamState } from "../store";
import { CSText } from "../src/components/CSText";
import { SharingControls, SharingAttributes } from "./SharingControls";
import { SmartFormattedList } from "./SmartFormattedList";
import { confirmPopup } from "./Confirm";
import { markdownify } from "./Markdowner";
import { EditorRevealRangeRequestType } from "../ipc/host.protocol.editor";
import { Range } from "vscode-languageserver-types";

interface Props extends ConnectedProps {
	streamId: string;
	editingReview?: CSReview;
	isEditing?: boolean;
}

interface ConnectedProps {
	teamMates: CSUser[];
	teamMembers: CSUser[];
	channelStreams: CSChannelStream[];
	directMessageStreams: CSDirectStream[];
	channel: CSStream;
	providerInfo: {
		[service: string]: {};
	};
	currentUser: CSUser;
	selectedStreams: {};
	showChannels: string;
	services: {};
	teamTagsArray: any;
	apiCapabilities: CSApiCapabilities;
	textEditorUri?: string;
	closePanel?: Function;
	repos: any;
	ignoredFiles: {
		[file: string]: boolean;
	};
}

interface State {
	title: string;
	text: string;
	assignees: { value: any; label: string }[] | { value: any; label: string };
	assigneesRequired: boolean;
	assigneesDisabled: boolean;
	singleAssignee: boolean;
	privacyMembers: { value: string; label: string }[];
	reviewers: CSUser[];
	notify: boolean;
	isLoading: boolean;
	isLoadingScm: boolean;
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
	assigneesInvalid?: boolean;
	sharingAttributesInvalid?: boolean;
	showAllChannels?: boolean;
	scmInfo: GetFileScmInfoResponse;
	defaultRepo?: any;
	selectedRepo?: any;
	selectedTags?: any;
	repoStatus: GetRepoScmStatusResponse;
	repoName: string;
	excludedFiles: {};
	fromCommit?: string;
	includeSaved: boolean;
	includeStaged: boolean;
	excludeCommit: { [sha: string]: boolean };
	startCommit: string;
	unsavedFiles: string[];
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

	constructor(props: Props) {
		super(props);
		const defaultState: Partial<State> = {
			title: "",
			text: "",
			assignees: [],
			assigneesDisabled: false,
			assigneesRequired: false,
			singleAssignee: false,
			selectedChannelName: (props.channel as any).name,
			selectedChannelId: props.channel.id,
			assignableUsers: this.getAssignableCSUsers(),
			reviewers: [],
			selectedTags: {},
			repoName: "",
			excludedFiles: {},
			includeSaved: true,
			includeStaged: true,
			excludeCommit: {},
			startCommit: "",
			unsavedFiles: []
		};

		const state = props.editingReview
			? merge(defaultState, props.editingReview)
			: ({
					isLoading: false,
					isLoadingScm: false,
					notify: false,
					...defaultState
			  } as State);

		let assignees: any;
		if (props.isEditing) {
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
		const scmInfo = await HostApi.instance.send(GetFileScmInfoRequestType, {
			uri: uri
		});
		this.setState({ scmInfo }, () => {
			this.handleRepoChange();
			if (callback) callback();
			this.setState({ isLoadingScm: false });
		});
	}

	componentDidMount() {
		const { textEditorUri } = this.props;
		if (textEditorUri) this.getScmInfoForURI(textEditorUri);
		this.focus();
	}

	async handleRepoChange() {
		const { repos } = this.props;
		const { includeSaved, includeStaged, startCommit } = this.state;
		const { scm } = this.state.scmInfo;
		if (!scm) return;

		const response = await HostApi.instance.send(GetRepoScmStatusRequestType, {
			uri: this.state.scmInfo.uri,
			startCommit,
			includeStaged,
			includeSaved
		});
		const repoId: string = response.scm ? response.scm.repoId || "" : "";
		const repoName = repos[repoId] ? repos[repoId].name : "";
		this.setState({ repoStatus: response, repoName });
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
		// if (this.isFormInvalid()) return;
		this.setState({ isLoading: true });

		const { title, text, selectedChannelId, selectedTags } = this.state;

		const csReviewers = (this.state.reviewers as any[]).map(a => a.value);

		try {
			let review = {
				title,
				text: replaceHtml(text)!,
				selectedChannelId,
				selectedTags,
				reviewers: csReviewers,
				tags: keyFilter(selectedTags)
			} as any;
			review.objects = [];
		} catch (error) {
		} finally {
			setTimeout(() => {
				this.setState({ isLoading: false });
			}, 1000);
		}
	};

	isFormInvalid = () => {
		const { text, title, assignees } = this.state;

		const validationState: Partial<State> = {
			titleInvalid: false,
			textInvalid: false,
			assigneesInvalid: false,
			sharingAttributesInvalid: false
		};

		let invalid = false;
		if (text.length === 0) {
			validationState.textInvalid = true;
			invalid = true;
		}

		if (!this.props.isEditing && !this._sharingAttributes) {
			invalid = true;
			validationState.sharingAttributesInvalid = true;
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

	handleKeyPress = (event: React.KeyboardEvent) => {
		if (event.key == "Enter") return this.switchChannel(event);
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
				teammates={this.props.teamMates}
				currentUserId={this.props.currentUser.id}
				services={this.props.services}
				channelStreams={this.props.channelStreams}
				teamProvider={"codestream"}
				isDirectMessage={this.props.channel.type === StreamType.Direct}
				text={text.replace(/\n/g, "<br/>")}
				placeholder="Description (Optional)"
				multiCompose
				onChange={this.handleChange}
				toggleTag={this.handleToggleTag}
				shouldShowRelatableCodemark={codemark =>
					this.props.editingReview ? codemark.id !== this.props.editingReview.id : true
				}
				onSubmit={this.handleClickSubmit}
				teamTags={this.props.teamTagsArray}
				selectedTags={this.state.selectedTags}
				__onDidRender={__onDidRender}
			/>
		);
	};

	render() {
		const { repoStatus } = this.state;
		const totalModifiedLines = repoStatus && repoStatus.scm ? repoStatus.scm.totalModifiedLines : 0;

		return (
			<div className="full-height-codemark-form">
				<span className="plane-container">
					<div className="codemark-form-container">{this.renderReviewForm()}</div>
					{this.renderExcludedFiles()}
					<div style={{ height: "20px" }}></div>
					{this.state.reviewers.length > 0 && (
						<>
							<CSText muted>
								<SmartFormattedList value={this.state.reviewers.map(m => m.fullName)} /> will be
								notified via email
							</CSText>
							<div style={{ height: "10px" }} />
						</>
					)}
					{totalModifiedLines > 25 && (
						<>
							<div style={{ display: "flex", padding: "0 0 10px 2px" }}>
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
						</>
					)}
					<CSText muted>
						CodeStream's lightweight code reviews let you request a review on the current state of
						your repo, without the friction of save, branch, commit, push, create PR, email, pull,
						web, email, web. Comments on your review are saved with the code even once merged in.
					</CSText>
				</span>
			</div>
		);
	}

	confirmCancel = () => {
		const { title, text, reviewers } = this.state;

		// if the user has made any changes in the form, confirm before closing
		if (title.length || text.length || reviewers.length) {
			confirmPopup({
				title: "Are you sure?",
				message: "Changes you made will not be saved.",
				centered: true,
				buttons: [
					{ label: "Go Back", className: "control-button" },
					{
						label: "Discard Review",
						wait: true,
						action: this.props.closePanel,
						className: "delete"
					}
				]
			});
		} else if (this.props.closePanel) {
			this.props.closePanel();
		}
	};

	exclude = (event: React.SyntheticEvent, file: string) => {
		const { excludedFiles } = this.state;
		this.setState({ excludedFiles: { ...excludedFiles, [file]: !excludedFiles[file] } });
	};

	excluded = (file: string) => {
		return this.state.excludedFiles[file] || this.props.ignoredFiles[file];
	};

	excludeFuture = (event: React.SyntheticEvent, file: string) => {
		const { repoStatus } = this.state;
		if (!repoStatus) return null;
		const { scm } = repoStatus;
		if (!scm) return null;

		event.stopPropagation();
		const ignoreFile = scm.repoPath + "/.codestreamignore";
		confirmPopup({
			title: "Exclude Files",
			message: (
				<>
					<span className="monospace highlight bold">{file}</span>{" "}
					<span className="subtle">has been added to the CodeStream ignore file </span>
					<span className="monospace highlight bold">{ignoreFile}</span>
				</>
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
		return null;
	};

	changeScmState = settings => {
		this.setState({ ...settings }, () => this.handleRepoChange());
	};

	setChangeStart = sha => {
		const { scm } = this.state.repoStatus;
		if (!scm) return;
		const { commits } = scm;
		if (!commits) return;

		// are we turning it on, or turning it off? checkbox=true means we're including
		const exclude = !this.state.excludeCommit[sha];

		const excludeCommit: { [sha: string]: boolean } = {};
		let newValue = false;
		let startCommit = "";
		commits.forEach(commit => {
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
					startCommit = commit.sha + "^";
				}
			}
		});

		this.changeScmState({ startCommit, excludeCommit });
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

	renderChange(id: string, onOff: boolean, title: string | ReactElement, message: string, onClick) {
		return (
			<div
				className={`row-with-icon-actions ellipsis-right-container ${onOff ? "" : "muted"}`}
				key={id}
			>
				<input type="checkbox" checked={onOff} onClick={onClick} /> {title}{" "}
				<span
					className="message"
					dangerouslySetInnerHTML={{
						__html: markdownify(message)
					}}
				/>
				<span className="actions" style={{ display: "none" }}>
					<Icon
						name="x"
						title="Exclude from review"
						className="clickable action"
						onClick={e => this.exclude(e, "")}
					/>
				</span>
			</div>
		);
	}

	renderGroupsAndCommits() {
		const { repoStatus, includeSaved, includeStaged, excludeCommit, unsavedFiles } = this.state;
		if (!repoStatus) return null;
		const { scm } = repoStatus;
		if (!scm) return null;
		const { commits } = scm;

		return (
			<div className="related">
				<div className="related-label">Changes to Include In Review</div>
				{unsavedFiles.length > 0 && (
					<div style={{ display: "flex", padding: "0 0 2px 2px" }}>
						<Icon name="alert" muted />
						<span style={{ paddingLeft: "10px" }}>
							You have unsaved changes. If you want to include any of those changes in this review,
							save them first.
						</span>
					</div>
				)}
				{this.renderChange("saved", includeSaved, "Saved Changes (Working Tree)", "4 files", () =>
					this.toggleSaved()
				)}
				{this.renderChange("staged", includeStaged, "Staged Changes (Index)", "6 files", () =>
					this.toggleStaged()
				)}
				{commits &&
					commits.map(commit =>
						this.renderChange(
							commit.sha,
							!excludeCommit[commit.sha],
							<span className="monospace">{commit.sha.substr(0, 8)}</span>,
							// @ts-ignore
							commit.info.shortMessage,
							() => this.setChangeStart(commit.sha)
						)
					)}
			</div>
		);
	}

	renderFile(filename, children?) {
		const { excludedFiles } = this.state;
		// https://davidwalsh.name/rtl-punctuation
		return (
			<div className="row-with-icon-actions monospace ellipsis-left-container">
				<span className="file-info ellipsis-left">
					<bdi dir="ltr">{filename}</bdi>
				</span>
				{children}
				{excludedFiles[filename] ? (
					<span className="actions">
						<Icon
							name="plus"
							title="Add back to review"
							placement="bottom"
							className="clickable action"
							onClick={e => this.exclude(e, filename)}
						/>
						<Icon
							name="trashcan"
							title="Exclude from future reviews"
							placement="bottom"
							className="clickable action"
							onClick={e => this.excludeFuture(e, filename)}
						/>
					</span>
				) : (
					<span className="actions">
						<Icon
							name="x"
							title="Exclude from review"
							className="clickable action"
							onClick={e => this.exclude(e, filename)}
						/>
					</span>
				)}
			</div>
		);
	}

	renderChangedFiles() {
		const { repoStatus, excludedFiles } = this.state;
		if (!repoStatus) return null;
		const { scm } = repoStatus;
		if (!scm) return null;
		const { addedFiles, modifiedFiles, deletedFiles } = scm;
		const added = addedFiles.filter(f => !excludedFiles[f]);
		const modified = modifiedFiles.filter(f => !excludedFiles[f.file]);
		const deleted = deletedFiles.filter(f => !excludedFiles[f]);
		if (added.length + modified.length + deleted.length === 0) return null;

		return [
			<div className="related" style={{ padding: "0", marginBottom: 0, position: "relative" }}>
				<div className="related-label">
					Changed Files{this.state.isLoadingScm && <Icon className="spin" name="sync" />}
				</div>
				{deleted.map(file => this.renderFile(file, <span className="deleted">deleted</span>))}
				{modified.map(file =>
					this.renderFile(
						file.file,
						<>
							{file.linesAdded > 0 && <span className="added">+{file.linesAdded} </span>}
							{file.linesRemoved > 0 && <span className="deleted">-{file.linesRemoved}</span>}
						</>
					)
				)}
				{added.map(file => this.renderFile(file, <span className="added">new</span>))}
			</div>
		];
	}

	renderExcludedFiles() {
		const { repoStatus, excludedFiles } = this.state;
		if (!repoStatus) return null;
		const { scm } = repoStatus;
		if (!scm) return null;
		const { addedFiles, modifiedFiles, deletedFiles } = scm;
		const added = addedFiles.filter(f => excludedFiles[f]);
		const modified = modifiedFiles.filter(f => excludedFiles[f.file]);
		const deleted = deletedFiles.filter(f => excludedFiles[f]);
		if (added.length + modified.length + deleted.length === 0) return null;

		return [
			<div className="related" style={{ padding: "0", marginBottom: 0, position: "relative" }}>
				<div className="related-label">Excluded from this Review</div>
				{deleted.map(file => this.renderFile(file, <span className="deleted">deleted</span>))}
				{modified.map(file =>
					this.renderFile(
						file.file,
						<>
							{file.linesAdded > 0 && <span className="added">+{file.linesAdded} </span>}
							{file.linesRemoved > 0 && <span className="deleted">-{file.linesRemoved}</span>}
						</>
					)
				)}
				{added.map(file => this.renderFile(file, <span className="added">new</span>))}
			</div>
		];
	}

	setFrom = (commit: string) => {};

	renderReviewForm() {
		const { editingReview, currentUser, repos } = this.props;
		const { scmInfo, repoStatus, repoName } = this.state;

		const modifier = navigator.appVersion.includes("Macintosh") ? "⌘" : "Alt";

		const submitTip = (
			<span>
				Submit Review<span className="keybinding extra-pad">{modifier} ENTER</span>
			</span>
		);

		const cancelTip = (
			<span>
				Discard Review<span className="keybinding extra-pad">ESC</span>
			</span>
		);

		return [
			<form className="standard-form review-form" key="form">
				<fieldset className="form-body">
					<div id="controls" className="control-group" key="controls1">
						<div key="headshot" className="headline">
							<Headshot person={currentUser} />
							<b>{currentUser.username}</b>
							<span className="subhead">
								is requesting a code review
								{scmInfo && scmInfo.scm && <>&nbsp;in&nbsp;</>}
							</span>
							{scmInfo && scmInfo.scm && (
								<>
									<span className="channel-label" style={{ display: "inline-block" }}>
										{repoName}
									</span>
									{scmInfo.scm.branch && (
										<>
											<span className="subhead">on branch&nbsp;</span>
											<span className="channel-label" style={{ display: "inline-block" }}>
												{scmInfo.scm.branch}
											</span>
										</>
									)}
								</>
							)}
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
								onChange={e => this.setState({ title: e.target.value })}
								placeholder="Title (required)"
								ref={ref => (this._titleInput = ref)}
							/>
						</div>
						{this.renderTextHelp()}
						{this.renderMessageInput()}
					</div>
					{this.renderTags()}
					<div className="related" style={{ padding: "0", marginBottom: 0, position: "relative" }}>
						<div className="related-label">Reviewers</div>
						{this.state.reviewers.map(person => {
							return (
								<span style={{ paddingRight: "10px" }}>
									<Headshot person={person} />
									{person.fullName}
								</span>
							);
						})}
						<span className="icon-button">
							<Icon name="plus" title="Specify who you want to review your code" />
						</span>
					</div>
					{this.renderChangedFiles()}
					{this.renderGroupsAndCommits()}
					{this.renderSharingControls()}
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
						<Tooltip title={submitTip} placement="bottom" delay={1}>
							<Button
								key="submit"
								style={{
									paddingLeft: "10px",
									paddingRight: "10px",
									// fixed width to handle the isLoading case
									width: "80px",
									marginRight: 0
								}}
								className="control-button"
								type="submit"
								loading={this.state.isLoading}
								onClick={this.handleClickSubmit}
							>
								Submit
							</Button>
						</Tooltip>
					</div>
					<div key="clear" style={{ clear: "both" }} />
				</fieldset>
			</form>
		];
	}
}

const EMPTY_OBJECT = {};

const mapStateToProps = (state: CodeStreamState): ConnectedProps => {
	const { context, editorContext, users, session, preferences, repos, apiVersioning } = state;
	const user = users[session.userId!] as CSMe;
	const channel = context.currentStreamId
		? getStreamForId(state.streams, context.currentTeamId, context.currentStreamId) ||
		  getStreamForTeam(state.streams, context.currentTeamId)
		: getStreamForTeam(state.streams, context.currentTeamId);

	const teamMates = getTeamMates(state);
	const teamMembers = getTeamMembers(state);
	const teamTagsArray = getTeamTagsArray(state);

	const channelStreams: CSChannelStream[] = sortBy(
		(getChannelStreamsForTeam(
			state.streams,
			context.currentTeamId,
			session.userId!
		) as CSChannelStream[]) || [],
		stream => (stream.name || "").toLowerCase()
	);

	const directMessageStreams: CSDirectStream[] = (
		getDirectMessageStreamsForTeam(state.streams, context.currentTeamId) || []
	).map(stream => ({
		...(stream as CSDirectStream),
		name: getDMName(stream, toMapBy("id", teamMates), session.userId)
	}));

	return {
		channel,
		teamMates,
		teamMembers,
		channelStreams: channelStreams,
		directMessageStreams: directMessageStreams,
		providerInfo: (user.providerInfo && user.providerInfo[context.currentTeamId]) || EMPTY_OBJECT,
		currentUser: user,
		selectedStreams: preferences.selectedStreams || EMPTY_OBJECT,
		showChannels: context.channelFilter,
		textEditorUri: editorContext.textEditorUri,
		services: state.services,
		teamTagsArray,
		repos,
		apiCapabilities: apiVersioning.apiCapabilities,
		ignoredFiles: {}
	};
};

const ConnectedReviewForm = connect(mapStateToProps, { closePanel })(ReviewForm);

export { ConnectedReviewForm as ReviewForm };
