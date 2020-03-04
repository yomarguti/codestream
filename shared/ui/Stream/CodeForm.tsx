import {
	GetFileScmInfoRequestType,
	GetFileScmInfoResponse,
	GetRepoScmStatusRequestType,
	GetRepoScmStatusResponse,
	GetReposScmRequestType,
	IgnoreFilesRequestType,
	ReposScm,
	DidChangeDataNotificationType,
	ChangeDataType,
	CreateBranchRequestType
} from "@codestream/protocols/agent";
import {
	CSDirectStream,
	CSReview,
	CSStream,
	CSUser,
	StreamType,
	CSApiCapabilities,
	CSMe
} from "@codestream/protocols/api";
import React from "react";
import { connect } from "react-redux";
import cx from "classnames";
import {
	getStreamForId,
	getStreamForTeam,
	getDirectMessageStreamsForTeam,
	getDMName
} from "../store/streams/reducer";
import { mapFilter, toMapBy, replaceHtml, keyFilter, safe } from "../utils";
import { HostApi } from "../webview-api";
import Button from "./Button";
import Tag from "./Tag";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import { sortBy as _sortBy, sortBy } from "lodash-es";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import { getTeamMembers, getTeamTagsArray, getTeamMates } from "../store/users/reducer";
import MessageInput from "./MessageInput";
import { closePanel } from "./actions";
import { CodeStreamState } from "../store";
import { CSText } from "../src/components/CSText";
import { SharingControls, SharingAttributes } from "./SharingControls";
import { confirmPopup } from "./Confirm";
import { markdownify } from "./Markdowner";
import { PostsActionsType } from "../store/posts/types";
import { DocumentData } from "../protocols/agent/agent.protocol.notifications";
import { Checkbox } from "../src/components/Checkbox";
import { RadioGroup, Radio } from "../src/components/RadioGroup";
import styled from "styled-components";
import { InlineMenu } from "../src/components/controls/InlineMenu";
import { CrossPostIssueContext } from "./CodemarkForm";
import CrossPostIssueControls from "./CrossPostIssueControls";

interface Props extends ConnectedProps {}

interface ConnectedProps {
	directMessageStreams: CSDirectStream[];
	channel: CSStream;
	providerInfo: {
		[service: string]: {};
	};
	currentUser: CSUser;
	selectedStreams: {};
	showChannels: string;
	teamTagsArray: any;
	textEditorUri?: string;
	closePanel?: Function;
	createPostAndCode?: Function;
	repos: any;
	shouldShare: boolean;
}

interface State {
	title: string;
	titleTouched: boolean;
	branch: string;
	defaultBranch: string;
	branchTouched: boolean;
	text: string;
	notify: boolean;
	isLoading: boolean;
	isLoadingScm: boolean;
	crossPostMessage: boolean;
	channelMenuOpen: boolean;
	channelMenuTarget: any;
	labelMenuOpen: boolean;
	labelMenuTarget: any;
	sharingDisabled?: boolean;
	selectedChannelName?: string;
	selectedChannelId?: string;
	titleInvalid?: boolean;
	textInvalid?: boolean;
	sharingAttributesInvalid?: boolean;
	showAllChannels?: boolean;
	scmInfo: GetFileScmInfoResponse;
	selectedTags?: any;
	repoStatus: GetRepoScmStatusResponse;
	openRepos: ReposScm[];
	repoName: string;
	newBranch: boolean;
}

function merge(defaults: Partial<State>, review: CSReview): State {
	return Object.entries(defaults).reduce((object, entry) => {
		const [key, value] = entry;
		object[key] = review[key] !== undefined ? review[key] : value;
		return object;
	}, Object.create(null));
}

const Root = styled.div`
	h2 {
		margin: 10px 0;
	}
`;

const StyledCheckbox = styled(Checkbox)`
	color: var(--text-color-subtle);
`;

const InputDropdown = styled.div`
	position: relative;
	margin-bottom: 10px;

	input[type="text"] {
		display: block;
		width: 100%;
		padding-right: 35px !important;
		margin: 0 !important;
	}
	.dropdown-button {
		position: absolute;
		cursor: pointer;
		top: 1px;
		right: 1px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: calc(100% - 2px);
		border-left: 1px solid var(--base-border-color);
		&:hover {
			color: var(--text-color-highlight);
			background: var(--base-background-color);
		}
	}
`;

class CodeForm extends React.Component<Props, State> {
	static defaultProps = {};
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
			selectedTags: {},
			repoName: ""
		};

		const state = {
			isLoading: false,
			isLoadingScm: false,
			notify: false,
			...defaultState
		} as State;

		this.state = {
			...state
		};
	}

	private async getScmInfoForURI(uri: string, callback?: Function) {
		this.setState({ isLoadingScm: true });

		const openRepos = await HostApi.instance.send(GetReposScmRequestType, {});
		if (openRepos && openRepos.repositories) this.setState({ openRepos: openRepos.repositories });

		const scmInfo = await HostApi.instance.send(GetFileScmInfoRequestType, {
			uri: uri
		});
		const defaultBranch = scmInfo && scmInfo.scm ? scmInfo.scm.branch || "" : "";
		this.setState({ scmInfo, defaultBranch }, () => {
			// this.handleRepoChange(uri);
			if (callback) callback();
		});
	}

	componentDidMount() {
		const { textEditorUri } = this.props;
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
					this.setState({ isLoadingScm: true });
					// this.handleRepoChange(textEditorUri);
				}
			})
		);

		this.focus();
	}

	componentWillUnmount = () => {
		this.disposables.forEach(d => d.dispose());
	};

	focus = () => {
		this._titleInput && this._titleInput.focus();
	};

	handleClickSubmit = async (event?: React.SyntheticEvent) => {
		event && event.preventDefault();
		if (this.state.isLoading) return;
		if (this.isFormInvalid()) return;
		this.setState({ isLoading: true });

		const { title, text, selectedChannelId, selectedTags, branch, defaultBranch } = this.state;

		try {
			// 1. create the branch
			// 2. update the status
			// 3. create a PR
			if (branch !== defaultBranch && this.props.textEditorUri) {
				const result = await HostApi.instance.send(CreateBranchRequestType, {
					branch,
					uri: this.props.textEditorUri
				});
				// FIXME handle error
				if (result.error) {
					console.log("ERROR FROM CREATE BRANCH: ", result.error);
					this.setState({ isLoading: false });
					return;
				}
			}
			if (this.props.createPostAndCode) {
				let review = {
					title,
					sharingAttributes: this.props.shouldShare ? this._sharingAttributes : undefined,
					text: replaceHtml(text)!,
					tags: keyFilter(selectedTags),
					status: "open"
				} as any;
				const { type: createResult } = await this.props.createPostAndCode(review);
				if (createResult !== PostsActionsType.FailPendingPost && this.props.closePanel)
					this.props.closePanel();
			}
		} catch (error) {
			console.log("ERROR FROM CREATE POST: ", error);
			// FIXME handle the error
			this.setState({ isLoading: false });
		} finally {
			this.setState({ isLoading: false });
		}
	};

	isFormInvalid = () => {
		const { text, title } = this.state;

		const validationState: Partial<State> = {
			titleInvalid: false,
			textInvalid: false,
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
		const repoId =
			this.state.repoStatus && this.state.repoStatus.scm ? this.state.repoStatus.scm.repoId : "";
		return (
			<div className="checkbox-row" style={{ marginTop: 0 }}>
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
				shouldShowRelatableCodemark={codemark => true}
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
			<Root className="full-height-codemark-form">
				<span className="plane-container">
					<div className="codemark-form-container">{this.renderCodeForm()}</div>
					<div style={{ height: "20px" }}></div>
					<CSText muted>
						This feature provides an easy way to start work on an item, and share that information
						with your team:
						<ol>
							<li>Create a branch</li>
							<li>Update your CodeStream status</li>
							<li>Post a message to your activity feed</li>
						</ol>
						Once your teammates give you feedback on your work, you can easily create a PR on
						GitHub.
					</CSText>
				</span>
			</Root>
		);
	}

	confirmCancel = () => {
		const { titleTouched, text } = this.state;

		// if the user has made any changes in the form, confirm before closing
		if (titleTouched || text.length) {
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

	renderCodeForm() {
		const { currentUser, repos } = this.props;
		const { isLoadingScm } = this.state;

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
						<div key="headshot" className="headline-flex" style={{ display: "none" }}>
							<div style={{ paddingRight: "7px" }}>
								<Headshot person={currentUser} />
							</div>
							<div style={{ marginTop: "-1px" }}>
								<b>{currentUser.username}</b>
								<span className="subhead">is starting work on</span>
							</div>
						</div>
						<h2>What are you working on?</h2>
						<div key="title" className="control-group">
							<InputDropdown>
								<input
									key="title-text"
									type="text"
									name="title"
									className="input-text control"
									tabIndex={0}
									value={this.state.title}
									onChange={e => this.setState({ title: e.target.value, titleTouched: true })}
									placeholder="Enter a title, or select a Trello card"
									ref={ref => (this._titleInput = ref)}
								/>
								<div className="dropdown-button">
									<Icon name="chevron-down" />
								</div>
							</InputDropdown>
							{false && (
								<CrossPostIssueContext.Provider
									value={{
										selectedAssignees: [],
										setValues: () => {},
										setSelectedAssignees: () => {}
									}}
								>
									<CrossPostIssueControls />
								</CrossPostIssueContext.Provider>
							)}

							<InputDropdown>
								<input
									type="text"
									name="branch"
									className="input-text control"
									tabIndex={0}
									value={this.state.branch}
									onChange={e => this.setState({ branch: e.target.value, branchTouched: true })}
									placeholder="Use an existing branch, or create a new one"
								/>
								<div className="dropdown-button">
									<Icon name="chevron-down" />
								</div>
							</InputDropdown>
							{this.renderTitleHelp()}
						</div>
						{this.renderTextHelp()}
						{this.renderMessageInput()}
					</div>
					{this.renderTags()}
					<div style={{ marginTop: "10px" }}>
						{/*
						<StyledCheckbox name="create-pr" onChange={() => {}}>
							Create a PR on <InlineMenu items={[{ label: "foo", key: "bar" }]}>GitHub</InlineMenu>
						</StyledCheckbox>
					*/}
						<StyledCheckbox name="create-pr" onChange={() => {}}>
							Move this card to{" "}
							<InlineMenu items={[{ label: "foo", key: "bar" }]}>In Progress</InlineMenu>on Trello
						</StyledCheckbox>
						<StyledCheckbox name="update-status" onChange={() => {}}>
							Update my status on Slack
						</StyledCheckbox>
						<StyledCheckbox name="update-status" onChange={() => {}}>
							Share what I'm working on with the team
						</StyledCheckbox>
					</div>
					{/* this.renderSharingControls() */}
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
									width: "120px",
									marginRight: 0
								}}
								className={cx("control-button", { cancel: !this.state.title })}
								type="submit"
								loading={this.state.isLoading}
								onClick={this.handleClickSubmit}
							>
								Create Branch
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
	const { context, editorContext, users, session, preferences, repos } = state;
	const user = users[session.userId!] as CSMe;
	const channel = context.currentStreamId
		? getStreamForId(state.streams, context.currentTeamId, context.currentStreamId) ||
		  getStreamForTeam(state.streams, context.currentTeamId)
		: getStreamForTeam(state.streams, context.currentTeamId);

	const teamMates = getTeamMates(state);
	const teamTagsArray = getTeamTagsArray(state);

	const directMessageStreams: CSDirectStream[] = (
		getDirectMessageStreamsForTeam(state.streams, context.currentTeamId) || []
	).map(stream => ({
		...(stream as CSDirectStream),
		name: getDMName(stream, toMapBy("id", teamMates), session.userId)
	}));

	return {
		shouldShare:
			safe(() => state.preferences[state.context.currentTeamId].shareCodemarkEnabled) || false,
		channel,
		directMessageStreams: directMessageStreams,
		providerInfo: (user.providerInfo && user.providerInfo[context.currentTeamId]) || EMPTY_OBJECT,
		currentUser: user,
		selectedStreams: preferences.selectedStreams || EMPTY_OBJECT,
		showChannels: context.channelFilter,
		textEditorUri: editorContext.textEditorUri,
		teamTagsArray,
		repos
	};
};

const ConnectedCodeForm = connect(mapStateToProps, { closePanel })(CodeForm);

export { ConnectedCodeForm as CodeForm };
