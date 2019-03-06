import {
	FetchAssignableUsersRequestType,
	GetRangeScmInfoResponse
} from "@codestream/protocols/agent";
import {
	CodemarkType,
	CSChannelStream,
	CSCodemark,
	CSDirectStream,
	CSStream,
	CSUser,
	StreamType
} from "@codestream/protocols/api";
import cx from "classnames";
import * as paths from "path-browserify";
import React from "react";
import { connect } from "react-redux";
import Select from "react-select";
import { getStreamForId, getStreamForTeam } from "../store/streams/reducer";
import { Stream } from "../store/streams/types";
import { mapFilter } from "../utils";
import { HostApi } from "../webview-api";
import Button from "./Button";
import CancelButton from "./CancelButton";
import CrossPostIssueControls from "./CrossPostIssueControls";
import { Board, CardValues } from "./CrossPostIssueControls/types";
import Icon from "./Icon";
import Menu from "./Menu";
import { PostCompose } from "./PostCompose";
import Tooltip from "./Tooltip";
import { sortBy as _sortBy } from "lodash-es";
import { EditorHighlightRangeRequestType } from "@codestream/protocols/webview";

const noop = () => {};

const tuple = <T extends string[]>(...args: T) => args;

const COLOR_OPTIONS = tuple("blue", "green", "yellow", "orange", "red", "purple", "aqua", "gray");
type Color = typeof COLOR_OPTIONS[number] | string;

interface Props {
	issueProvider?: string;
	providerInfo: {
		[service: string]: {};
	};
	channel: Stream;
	channelStreams: CSChannelStream[];
	directMessageStreams: CSDirectStream[];
	currentUserId: string;
	teammates: CSUser[];
	streamId: string;
	isSlackTeam: boolean;
	collapseForm: Function;
	onSubmit: Function;
	onClickClose(): any;
	renderMessageInput(props: { [key: string]: any }): JSX.Element;
	openCodemarkForm(type: string): any;
	slackInfo?: {};
	codeBlock?: GetRangeScmInfoResponse;
	commentType?: string;
	collapsed: boolean;
	isEditing?: boolean;
	editingCodemark?: CSCodemark;
	placeholder?: string;
	selectedStreams: {};
	showChannels: string;
}

interface State {
	text: string;
	color: Color;
	type: string;
	assignees: { value: any; label: string }[] | { value: any; label: string };
	assigneesRequired: boolean;
	assigneesDisabled: boolean;
	singleAssignee: boolean;
	privacy: "private" | "public";
	notify: boolean;
	isLoading: boolean;
	crossPostMessage: boolean;
	assignableUsers: { value: any; label: string }[];
	channelMenuOpen: boolean;
	channelMenuTarget: any;
	selectedChannelName?: string;
	selectedChannelId?: string;
	title?: string;
	codeBlockInvalid?: boolean;
	titleInvalid?: boolean;
	textInvalid?: boolean;
	assigneesInvalid?: boolean;
	showAllChannels?: boolean;
}

function merge(defaults: Partial<State>, codemark: CSCodemark): State {
	return Object.entries(defaults).reduce((object, entry) => {
		const [key, value] = entry;
		object[key] = codemark[key] !== undefined ? codemark[key] : value;
		return object;
	}, Object.create(null));
}

class CodemarkForm extends React.Component<Props, State> {
	static defaultProps = {
		commentType: "comment",
		isEditing: false
	};
	tabIndexCount = 0;
	_titleInput: HTMLElement | null = null;
	insertTextAtCursor?: Function;
	focusOnMessageInput?: Function;
	crossPostIssueValues?: CardValues;

	constructor(props: Props) {
		super(props);
		const defaultType =
			(props.codeBlock ? (props.codeBlock as any).type : null) || props.commentType;
		const defaultState: Partial<State> = {
			title: "",
			text: "",
			color: "blue",
			type: defaultType,
			assignees: [],
			assigneesDisabled: false,
			assigneesRequired: false,
			singleAssignee: false,
			selectedChannelName: props.channel.name,
			selectedChannelId: props.channel.id,
			assignableUsers: this.getAssignableCSUsers(),
			privacy: "private"
		};

		const state = props.editingCodemark
			? merge(defaultState, props.editingCodemark)
			: ({
					isLoading: false,
					notify: false,
					...defaultState
			  } as State);

		let assignees: any;
		if (state.assignees === undefined) {
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
	}

	static getDerivedStateFromProps(props: Props, state: State) {
		// revisit this if the ability to change the type is added back to the form
		// TODO: this should call ComposeBox.repositionIfNecessary()
		if (props.commentType !== state.type) {
			return { type: props.commentType };
		}
		return null;
	}

	componentDidMount() {
		if (this.props.codeBlock) {
			const codeBlock = this.props.codeBlock;
			HostApi.instance.send(EditorHighlightRangeRequestType, {
				uri: codeBlock.uri,
				range: codeBlock.range,
				highlight: true
			});
		}
		this.focus();
		this.handleCodeHighlightEvent();
	}

	componentDidUpdate(prevProps: Props) {
		if (prevProps.codeBlock !== this.props.codeBlock && !prevProps.isEditing) {
			this.handleCodeHighlightEvent();
		}
		if (prevProps.issueProvider !== this.props.issueProvider) {
			this.setState({
				assignableUsers: this.getAssignableCSUsers(),
				assignees: [],
				assigneesDisabled: false,
				assigneesRequired: false,
				singleAssignee: false
			});
			this.crossPostIssueValues = undefined;
		}
	}

	componentWillUnmount() {
		if (this.props.codeBlock) {
			const codeBlock = this.props.codeBlock as GetRangeScmInfoResponse;
			HostApi.instance.send(EditorHighlightRangeRequestType, {
				uri: codeBlock.uri,
				range: codeBlock.range,
				highlight: false
			});
		}
	}

	getAssignableCSUsers() {
		return mapFilter(this.props.teammates, user => {
			if (!user.isRegistered) return;
			return {
				value: user.id,
				label: user.username
			};
		});
	}

	async loadAssignableUsers(service: string, board: Board) {
		if (board.assigneesDisabled) return this.setState({ assigneesDisabled: true });
		if (board.assigneesRequired) {
			this.setState(state => (state.assigneesRequired ? null : { assigneesRequired: true }));
		}
		if (board.singleAssignee) {
			this.setState(state => (state.singleAssignee ? null : { singleAssignee: true }));
		}
		const { users } = await HostApi.instance.send(FetchAssignableUsersRequestType, {
			providerName: service,
			boardId: board.apiIdentifier || board.id
		});

		this.setState({
			assignableUsers: users.map(u => ({
				value: u,
				label: u.displayName
			}))
		});
	}

	handleCrossPostIssueValues = (values: CardValues) => {
		const selectedNewBoard = Boolean(values.board);
		const enablingCrossPostIssue =
			(!this.crossPostIssueValues || !this.crossPostIssueValues.isEnabled) &&
			values &&
			values.isEnabled;
		if (
			enablingCrossPostIssue ||
			(!this.crossPostIssueValues && selectedNewBoard) ||
			(this.crossPostIssueValues &&
				values.isEnabled &&
				this.crossPostIssueValues.board &&
				selectedNewBoard &&
				this.crossPostIssueValues.board.id !== values.board!.id)
		) {
			this.setState({ assignees: [] });
			this.loadAssignableUsers(values.provider, values.board!);
		} else if (
			!values.isEnabled &&
			this.crossPostIssueValues &&
			this.crossPostIssueValues.isEnabled
		) {
			this.setState({ assignees: [], assignableUsers: this.getAssignableCSUsers() });
		}
		this.crossPostIssueValues = values;
	};

	handleCodeHighlightEvent = () => {
		const { codeBlock } = this.props;

		this.setState({ codeBlockInvalid: false });

		if (!codeBlock) return;

		let mentions: Record<"id" | "username", string>[] = [];
		if (codeBlock.scm && codeBlock.scm.authors) {
			mentions = codeBlock.scm.authors.filter(author => author.id !== this.props.currentUserId);
		}

		if (mentions.length > 0) {
			// TODO handle users with no username
			const usernames: string[] = mentions.map(u => `@${u.username}`);
			// if there's text in the compose area, return without
			// adding the suggestion
			if (this.state.text.length > 0) return;
			// the reason for this unicode space is that chrome will
			// not render a space at the end of a contenteditable div
			// unless it is a &nbsp;, which is difficult to insert
			// so we insert this unicode character instead
			this.focusOnMessageInput &&
				this.focusOnMessageInput(() => {
					this.insertTextAtCursor && this.insertTextAtCursor(usernames.join(", ") + ":\u00A0");
				});
		}
	};

	tabIndex = () => {
		return (global as any).atom ? this.tabIndexCount++ : 0;
	};

	// TODO: work on this from initial mount
	focus = (forceMainInput = false) => {
		// if (forceMainInput && this._contentEditable) return this._contentEditable.htmlEl.focus();

		switch (this.state.type) {
			case "question":
			case "issue":
			case "bookmark":
				this._titleInput && this._titleInput.focus();
				break;
			case "snippet":
			case "comment":
			default:
				this.focusOnMessageInput && this.focusOnMessageInput();
		}
	};

	// onSelectCodemarkType = (type?: string) => {
	// 	this.setState({ menuOpen: false });
	// 	if (type) this.setCommentType(type);
	// }

	setCommentType = (type: string) => {
		if (this.props.editingCodemark) return;
		this.setState({
			type,
			codeBlockInvalid: false,
			titleInvalid: false,
			textInvalid: false
		});
		// setTimeout(() => {
		// 	// this.focus();
		// }, 20);
	};

	togglePrivacy = () => {
		this.setState(state => ({ privacy: state.privacy === "public" ? "private" : "public" }));
	};

	toggleNotify = () => {
		this.setState({ notify: !this.state.notify });
	};

	toggleCrossPostMessage = () => {
		this.setState(state => ({ crossPostMessage: !state.crossPostMessage }));
	};

	handleClickSubmit = (event?: React.SyntheticEvent) => {
		event && event.preventDefault();
		if (this.isFormInvalid()) return;

		const { color, type, title, text, selectedChannelId } = this.state;
		const crossPostIssueEnabled =
			type === CodemarkType.Issue &&
			this.crossPostIssueValues &&
			this.crossPostIssueValues.isEnabled;

		let csAssignees: string[] = [];
		if (crossPostIssueEnabled) {
			const assignees = Array.isArray(this.state.assignees)
				? this.state.assignees
				: [this.state.assignees];

			csAssignees = mapFilter(assignees, a => {
				const user = a.value;
				const codestreamUser = this.props.teammates.find(t => t.email === user.email);
				if (codestreamUser) return codestreamUser.id;
				return undefined;
			});
			this.crossPostIssueValues!.assignees = assignees.map(a => a.value);
		} else csAssignees = (this.state.assignees as any[]).map(a => a.value);

		this.props.onSubmit(
			{
				streamId: selectedChannelId,
				text,
				color,
				type,
				assignees: csAssignees,
				title,
				crossPostIssueValues: crossPostIssueEnabled ? this.crossPostIssueValues : undefined
				// privacy,
				// notify,
				// crossPostMessage,
			},
			event
		);
	};

	isFormInvalid = () => {
		const { codeBlock } = this.props;
		const { text, title, assignees, assigneesRequired, type } = this.state;

		const validationState = {
			codeBlockInvalid: false,
			titleInvalid: false,
			textInvalid: false,
			assigneesInvalid: false
		};

		let invalid = false;
		if (type === "trap" || type === "bookmark") {
			if (!codeBlock) {
				validationState.codeBlockInvalid = true;
				invalid = true;
			}
		}
		if (type === "question" || type === "issue") {
			if (!title || title.length === 0) {
				validationState.titleInvalid = true;
				invalid = true;
			}
			if (
				assigneesRequired &&
				(!assignees || (Array.isArray(assignees) && assignees.length === 0))
			) {
				invalid = validationState.assigneesInvalid = true;
			}
		}
		if (type === "comment" || type === "trap") {
			if (text.length === 0) {
				validationState.textInvalid = true;
				invalid = true;
			}
		}

		this.setState(validationState);
		return invalid;
	};

	showAlertHelp = event => {
		event.stopPropagation();
	};

	renderTitleHelp = () => {
		const { titleInvalid } = this.state;

		if (titleInvalid) {
			return <small className="error-message">Required</small>;
		} else return null;
	};

	renderTextHelp = () => {
		const { textInvalid } = this.state;

		if (textInvalid) {
			return <small className="error-message">Required</small>;
		} else return null;
	};

	switchChannel = (event: React.SyntheticEvent) => {
		event.stopPropagation();
		const target = event.target;
		this.setState(state => ({
			channelMenuOpen: !state.channelMenuOpen,
			channelMenuTarget: target,
			crossPostMessage: true
		}));
	};

	selectChannel = (stream: Stream | "show-all") => {
		if (stream === "show-all") {
			this.setState({ showAllChannels: true });
			return;
		} else if (stream && stream.id) {
			const channelName = (stream.type === StreamType.Direct ? "@" : "#") + stream.name;
			this.setState({ selectedChannelName: channelName, selectedChannelId: stream.id });
		}
		this.setState({ channelMenuOpen: false });
	};

	// handleClickConnectSlack = async event => {
	// 	event.preventDefault();
	// 	this.setState({ isLoading: true });
	// 	await HostApi.instance.send(GoToSlackSignin); // TODO: use the provider api
	// 	this.setState({ isLoading: false });
	// }

	renderCrossPostMessage = () => {
		const { selectedStreams, showChannels } = this.props;
		const { showAllChannels } = this.state;
		// if (this.props.slackInfo || this.props.providerInfo.slack) {
		const items: { label: string; action?: CSStream | "show-all" }[] = [];

		const filterSelected = showChannels === "selected" && !showAllChannels;
		this.props.channelStreams.forEach(channel => {
			if (!filterSelected || selectedStreams[channel.id]) {
				items.push({ label: "#" + channel.name, action: channel });
			}
		});
		items.push({ label: "-" });
		_sortBy(this.props.directMessageStreams, (stream: CSDirectStream) =>
			(stream.name || "").toLowerCase()
		).forEach((channel: CSDirectStream) => {
			if (!filterSelected || selectedStreams[channel.id]) {
				items.push({ label: "@" + channel.name, action: channel });
			}
		});

		if (filterSelected) {
			items.push({ label: "-" });
			items.push({ label: "Show All Channels & DMs", action: "show-all" });
		}

		const channelName = this.state.selectedChannelName;
		return (
			<div className="checkbox-row">
				{/*<input type="checkbox" checked={this.state.crossPostMessage} /> */} Post to{" "}
				<span className="channel-label" onClick={this.switchChannel}>
					{channelName}
					<Icon name="chevron-down" />
					{this.state.channelMenuOpen && (
						<Menu
							align="center"
							compact={true}
							target={this.state.channelMenuTarget}
							items={items}
							action={this.selectChannel}
						/>
					)}
				</span>
				{this.props.isSlackTeam && [
					" on",
					<span className="service">
						<Icon className="slack" name="slack" />
						Slack
					</span>
				]}
			</div>
		);
		// }
		// else {
		// 	return (
		// 		<div className="checkbox-row connect-messaging" onClick={this.toggleCrossPostMessage}>
		// 			Post to
		// 			<span className="service" onClick={this.handleClickConnectSlack}>
		// 				<Icon className="slack" name="slack" />
		// 				Slack
		// 			</span>
		// 			{this.state.isLoading && (
		// 				<span>
		// 					<Icon className="spin" name="sync" /> Syncing channels...
		// 				</span>
		// 			)}
		// 		</div>
		// 	);
		// }
	};

	handleChange = text => {
		// track newPostText as the user types
		this.setState({
			text
		});
	};

	getCodeBlockHint() {
		const { codeBlock, editingCodemark } = this.props;
		if (!codeBlock || !codeBlock.range) return "Select a range to comment on a block of code.";

		let lines: string;
		if (codeBlock.range.start.line === codeBlock.range.end.line) {
			lines = `(Line ${codeBlock.range.start.line + 1})`;
		} else {
			lines = `(Lines ${codeBlock.range.start.line + 1}-${codeBlock.range.end.line + 1})`;
		}

		const commentType = editingCodemark ? editingCodemark.type : this.state.type;
		const titleLabel =
			commentType === "issue"
				? "Issue in "
				: commentType === "question"
				? "Question in "
				: commentType === "bookmark"
				? "Bookmark in "
				: commentType === "link"
				? "Permalink for "
				: "";

		const scm = codeBlock.scm;
		const file = scm && scm.file ? paths.basename(scm.file) : "";
		return titleLabel + file + " " + lines;
	}

	renderMessageInput = () => {
		const { codeBlock, collapsed } = this.props;
		const { type, text } = this.state;
		let placeholder = this.props.placeholder;

		if (codeBlock) {
			// const range = codeBlock ? arrayToRange(codeBlock.location) : null;
			// let rangeText = "";
			// if (range && codeBlock && codeBlock.file) {
			// 	rangeText += "Add comment for " + codeBlock.file;
			// 	const endLine = range.end.col == 0 ? range.end.row : range.end.row + 1;
			// 	if (range.start.row + 1 === endLine) {
			// 		rangeText += " line " + (range.start.row + 1);
			// 	} else {
			// 		rangeText += " lines " + (range.start.row + 1) + "-" + endLine;
			// 	}
			// 	// placeholder = rangeText;
			// }
			if (type === "question") placeholder = "Answer (optional)";
			else if (type === "issue") placeholder = "Description (optional)";
			else placeholder = "Add comment";
		}

		const __onDidRender = ({ insertTextAtCursor, focus }) => {
			this.insertTextAtCursor = insertTextAtCursor;
			this.focusOnMessageInput = focus;
		};

		return this.props.renderMessageInput({
			text,
			placeholder,
			multiCompose: !collapsed,
			onChange: this.handleChange,
			onSubmit: this.handleClickSubmit,
			__onDidRender
		});
	};

	render() {
		if (this.props.collapsed) {
			return (
				<PostCompose
					onClickClose={this.props.onClickClose}
					openCodemarkForm={this.props.openCodemarkForm}
					openDirection={"down"}
					renderMessageInput={this.renderMessageInput}
					onSubmit={noop}
				/>
			);
		}

		const { editingCodemark } = this.props;
		const commentType = editingCodemark ? editingCodemark.type : this.state.type || "comment";
		// const { menuTarget } = this.state;

		const trapTip =
			"Let your teammates know about a critical section of code that should not be changed without discussion or consultation.";
		// const bookmarkTip =
		// 	'Save a bookmark either for yourself, or for your team (select the appropriate "Post to" setting above).';

		const titlePlaceholder =
			commentType === "issue"
				? "Title (required)"
				: commentType === "question"
				? "Question (required)"
				: commentType === "bookmark"
				? "Bookmark Name (optional)"
				: "Title (optional)";

		// const commentString = commentType || "comment";
		// const submitAnotherLabel = `Command-click to submit another ${commentString} after saving`;

		// const menuItems = [
		// 	{ label: "New Comment", action: "comment" },
		// 	{ label: "New Question", action: "question" },
		// 	{ label: "New Issue", action: "issue" },
		// 	{ label: "New Trap", action: "trap" },
		// 	{ label: "New Bookmark", action: "bookmark" }
		// ];
		//
		// const menu = this.state.menuOpen ? (
		// 	<Menu items={menuItems} target={menuTarget} action={this.onSelectCodemarkType} align="left" />
		// ) : null;
		//
		// if (false && !commentType) {
		// 	return (
		// 		<form id="code-comment-form" className="standard-form narrow" key="two">
		// 			<Icon
		// 				name="plus"
		// 				onClick={() => {
		// 					this.setState({ type: "comment" });
		// 				}}
		// 			/>
		// 			{menu}
		// 		</form>
		// 	);
		// }

		const assigneesPlaceholder = this.props.providerInfo["trello"]
			? "Members (optional)"
			: "Assignees (optional)";
		// {isEditing ? "Update" : "New"}{" "}
		// {commentString.charAt(0).toUpperCase() + commentString.slice(1)}
		// <div className="range-text">{rangeText}</div>
		return [
			<div className="panel-header" key="one">
				{/*
					<span className="align-left-button" onClick={() => this.props.collapseForm()}>
						<Icon name="chevron-up" />
					</span>
				*/}
				<CancelButton placement="left" onClick={this.props.onClickClose} />
			</div>,

			<form id="code-comment-form" className="standard-form" key="two">
				<fieldset className="form-body">
					<div id="controls" className="control-group">
						{<div style={{ marginBottom: "10px" }}>{this.getCodeBlockHint()}</div>}
						<div className="tab-group" style={{ display: "none" }}>
							<input
								id="radio-comment-type-comment"
								type="radio"
								name="comment-type"
								checked={commentType === "comment"}
							/>
							<label
								htmlFor="radio-comment-type-comment"
								className={cx({
									checked: commentType === "comment"
								})}
								onClick={e => this.setCommentType("comment")}
							>
								<Icon name="comment" className="chat-bubble" /> <b>Comment</b>
							</label>
							{/*<input
								id="radio-comment-type-question"
								type="radio"
								name="comment-type"
								checked={commentType === "question"}
							/>
							<label
								htmlFor="radio-comment-type-question"
								className={cx({
									checked: commentType === "question"
								})}
								onClick={e => this.setCommentType("question")}
							>
								<Icon name="question" /> <b>FAQ</b>
							</label>*/}
							<input
								id="radio-comment-type-issue"
								type="radio"
								name="comment-type"
								checked={commentType === "issue"}
							/>
							<label
								htmlFor="radio-comment-type-issue"
								className={cx({
									checked: commentType === "issue"
								})}
								onClick={e => this.setCommentType("issue")}
							>
								<Icon name="issue" /> <b>Issue</b>
							</label>
							{
								// <input
								// 	id="radio-comment-type-trap"
								// 	type="radio"
								// 	name="comment-type"
								// 	checked={commentType === "trap"}
								// />
								// <label
								// 	htmlFor="radio-comment-type-trap"
								// 	className={cx({
								// 		checked: commentType === "trap"
								// 	})}
								// 	onClick={e => this.setCommentType("trap")}
								// >
								// 	<Icon name="trap" /> <b>Trap</b>
								// </label>
							}
							<label
								htmlFor="radio-comment-type-bookmark"
								className={cx({
									checked: commentType === "bookmark"
								})}
								onClick={e => this.setCommentType("bookmark")}
							>
								<Icon name="bookmark" /> <b>Bookmark</b>
							</label>

							<label
								htmlFor="radio-comment-type-link"
								className={cx({
									checked: commentType === "link"
								})}
								onClick={e => this.setCommentType("link")}
							>
								<Icon name="link" /> <b>Permalink</b>
							</label>
						</div>
						{commentType === "trap" && (
							<div className="hint frame control-group" style={{ marginBottom: "10px" }}>
								{trapTip}
							</div>
						)}
						{/* false && commentType === "bookmark" && (
							<div className="hint frame control-group" style={{ marginBottom: "10px" }}>
								{bookmarkTip}
							</div>
						) */}
						{(commentType === "issue" ||
							commentType === "question" ||
							commentType === "bookmark" ||
							commentType === "snippet") && (
							<div className="control-group">
								{this.renderTitleHelp()}
								<input
									type="text"
									name="title"
									className="native-key-bindings input-text control"
									tabIndex={this.tabIndex()}
									value={this.state.title}
									onChange={e => this.setState({ title: e.target.value })}
									placeholder={titlePlaceholder}
									ref={ref => (this._titleInput = ref)}
								/>
							</div>
						)}
						{commentType === "issue" && (
							<div id="members-controls" className="control-group" style={{ marginBottom: "10px" }}>
								{!this.state.assigneesDisabled && (
									<Select
										id="input-assignees"
										name="assignees"
										classNamePrefix="native-key-bindings react-select"
										isMulti={!this.state.singleAssignee}
										value={this.state.assignees}
										options={this.state.assignableUsers}
										closeMenuOnSelect={true}
										isClearable={false}
										placeholder={assigneesPlaceholder}
										onChange={value => this.setState({ assignees: value! })}
										tabIndex={this.tabIndex().toString()}
									/>
								)}
							</div>
						)}
						{this.renderTextHelp()}
						{commentType === "link" && [
							<div className="permalink" key="2">
								https://codestream.com/{this.state.privacy === "private" ? "r" : "u"}/
								{this.props.streamId}
							</div>,
							<div id="privacy-controls" className="control-group" key="1">
								<div className="public-private-hint">
									{this.state.privacy === "private"
										? "Only members of your team can access this link."
										: "Anyone can view this link, including quoted codeblock."}
								</div>
								<div
									className={cx("switch public-private", {
										checked: this.state.privacy === "private"
									})}
									onClick={this.togglePrivacy}
								/>
							</div>
						]}
						{commentType !== "bookmark" && commentType !== "link" && [this.renderMessageInput()]}
					</div>
					{false && (commentType === "comment" || commentType === "question") && (
						<div className="checkbox-row" onClick={this.toggleNotify}>
							<input type="checkbox" checked={this.state.notify} /> Alert me if someone edits code
							in this range{"  "}
							<Tooltip title="Click to learn more">
								<span>
									<Icon className="clickable" onClick={this.showAlertHelp} name="info" />
								</span>
							</Tooltip>
						</div>
					)}
					{commentType !== "link" && this.renderCrossPostMessage()}
					{commentType === "issue" && (
						<CrossPostIssueControls
							provider={this.props.issueProvider}
							onValues={this.handleCrossPostIssueValues}
							codeBlock={this.props.codeBlock as any}
						/>
					)}
					{commentType !== "link" && (
						<div className="color-choices">
							{COLOR_OPTIONS.map(color => (
								<label
									onClick={e => this.setState({ color })}
									key={color}
									className={cx("color-choice-box", `${color}-color`, {
										selected: this.state.color === color
									})}
								>
									<Icon name={commentType} />
								</label>
							))}
						</div>
					)}
					<div
						className="button-group"
						style={{
							marginLeft: "10px",
							float: "right",
							width: "auto",
							marginRight: 0
						}}
					>
						<Button
							style={{
								paddingLeft: "10px",
								paddingRight: "10px",
								width: "auto"
							}}
							className="control-button cancel"
							type="submit"
							loading={this.state.isLoading}
							onClick={this.props.onClickClose}
						>
							Cancel
						</Button>
						<Button
							style={{
								paddingLeft: "10px",
								paddingRight: "10px",
								width: "auto",
								marginRight: 0
							}}
							className="control-button"
							type="submit"
							loading={this.state.isLoading}
							onClick={this.handleClickSubmit}
						>
							{commentType === "link" ? "Copy Link" : "Submit"}
						</Button>
						{/*
							<span className="hint">Styling with Markdown is supported</span>
						*/}
					</div>
					<div style={{ clear: "both" }} />
					{/*
						<div
							style={{ marginTop: "30px", cursor: "pointer" }}
							onClick={this.props.toggleOpenCommentOnSelect}
						>
							<span
								style={{ float: "right", marginLeft: "10px" }}
								className={createClassString("switch", {
									checked: this.props.openCommentOnSelect
								})}
							/>
							Auto-open when selecting code and CodeStream is visible
						</div>
					*/}
				</fieldset>
			</form>
		];
		// 	<span className="hixnt" style={{ grid: "none" }}>
		// 	<input type="checkbox" />
		// 	Open automatically on selection
		// </span>
		// 	<input
		// 	id="radio-comment-type-snippet"
		// 	type="radio"
		// 	name="comment-type"
		// 	checked={commentType === "snippet"}
		// 	onChange={e => this.setCommentType("snippet")}
		// />
		// <label
		// 	htmlFor="radio-comment-type-snippet"
		// 	className={createClassString({
		// 		checked: commentType === "snippet"
		// 	})}
		// >
		// 	<Icon name="code" /> <span>Snippet</span>
		// </label>
	}
}

const EMPTY_OBJECT = {};

const mapStateToProps = state => {
	const { context, users, session, teams, preferences } = state;
	const user = users[session.userId];
	const channel = context.currentStreamId
		? getStreamForId(state.streams, context.currentTeamId, context.currentStreamId)!
		: getStreamForTeam(state.streams, context.currentTeamId);

	// const slackInfo = user.providerInfo && user.providerInfo.slack;

	const team = teams[context.currentTeamId];
	const isSlackTeam = !!(team.providerInfo && team.providerInfo.slack);

	return {
		channel,
		issueProvider: context.issueProvider,
		providerInfo: (user.providerInfo && user.providerInfo[context.currentTeamId]) || EMPTY_OBJECT,
		isSlackTeam,
		selectedStreams: preferences.selectedStreams || EMPTY_OBJECT,
		showChannels: context.channelFilter
		// slackInfo,
	};
};

const ConnectedCodemarkForm = connect(mapStateToProps)(CodemarkForm);

export { ConnectedCodemarkForm as CodemarkForm };
