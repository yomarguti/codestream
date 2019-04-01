import cx from "classnames";
import React from "react";
import { connect } from "react-redux";
import { setCodemarkStatus, setUserPreference } from "./actions";
import Headshot from "./Headshot";
import Icon from "./Icon";
import Menu from "./Menu";
import { markdownify } from "./Markdowner";
import Timestamp from "./Timestamp";
import CodemarkDetails from "./CodemarkDetails";
import { DocumentMarker } from "@codestream/protocols/agent";
import { CodemarkType, CSUser } from "@codestream/protocols/api";
import { HostApi } from "../webview-api";
import { SetCodemarkPinnedRequestType } from "@codestream/protocols/agent";
import { UpdateConfigurationRequestType } from "@codestream/protocols/webview";
import { validateSignup } from "../Login/actions";
import { range } from "../utils";

// TODO: Why not use CSCodemark here? or CodemarkPlus?
interface CodemarkEntity {
	id: string;
	color: string;
	type: CodemarkType;
	createdAt: number;
	streamId: string;
	version: number;
	postId?: string;
	parentPostId?: string;
	text?: string;
	title?: string;
	markers?: {
		file?: string;
	};
	status?: string;
	creatorId?: string;
	pinned?: boolean;
	numReplies: number;
}
interface State {
	menuOpen?: boolean;
	menuTarget?: any;
	showLabelText: boolean;
}
interface Props {
	currentUser: CSUser;
	selected?: boolean;
	collapsed?: boolean;
	inline?: boolean;
	codemark: CodemarkEntity;
	marker: DocumentMarker;
	usernames: string[];
	setCodemarkStatus: Function;
	action(action: string, post: any, args: any): any;
	onClick?(codemark: CodemarkEntity, marker: DocumentMarker): any;
	onMouseEnter?(marker: DocumentMarker): any;
	onMouseLeave?(marker: DocumentMarker): any;
	query?: string;
	style?: object;
	lineNum?: Number;
	capabilities: any;
	top?: Number;
	showLabelText?: boolean;
	threadDivs?: any;
	codemarkKeybindings: string[];
	setUserPreference: Function;
}

export class Codemark extends React.Component<Props, State> {
	static defaultProps = {
		style: {}
	};

	constructor(props: Props) {
		super(props);
		this.state = {
			menuOpen: false,
			showLabelText: false
		};
	}

	render() {
		if (this.props.inline) return this.renderInlineCodemark();
		if (this.props.collapsed) return this.renderCollapsedCodemark();
		else return null;
	}

	renderTextLinkified = text => {
		let html;
		if (text == null || text === "") {
			html = "";
		} else {
			const me = this.props.currentUser.username.toLowerCase();
			html = markdownify(text).replace(/@(\w+)/g, (match, name) => {
				const nameNormalized = name.toLowerCase();
				if (this.props.usernames[nameNormalized]) {
					return `<span class="at-mention${nameNormalized === me ? " me" : ""}">${match}</span>`;
				}

				return match;
			});

			if (this.props.query) {
				const matchQueryRegexp = new RegExp(this.props.query, "gi");
				html = html.replace(matchQueryRegexp, "<u><b>$&</b></u>");
			}
		}

		return <span dangerouslySetInnerHTML={{ __html: html }} />;
	};

	renderTypeIcon() {
		const { codemark } = this.props;
		let icon: JSX.Element | null = null;
		switch (codemark.type) {
			case "question":
				icon = <Icon name="question" className="type-icon" />;
				break;
			case "bookmark":
				icon = <Icon name="bookmark" className="type-icon" />;
				break;
			case "trap":
				icon = <Icon name="trap" className="type-icon" />;
				break;
			case "issue":
				icon = <Icon name="issue" className="type-icon" />;
				break;
			default:
				icon = <Icon name="comment" className="type-icon" />;
		}
		return icon;
	}

	handleClickStatusToggle = (event: React.SyntheticEvent): any => {
		event.stopPropagation();
		const { codemark } = this.props;
		if (codemark.status === "closed") this.openIssue();
		else this.closeIssue();
	};

	closeIssue = () => {
		const { codemark, setCodemarkStatus } = this.props;
		setCodemarkStatus(codemark.id, "closed");
		this.submitReply("/me closed this issue");
	};

	openIssue = () => {
		const { codemark, setCodemarkStatus } = this.props;
		setCodemarkStatus(codemark.id, "open");
		this.submitReply("/me reopened this issue");
	};

	submitReply = text => {
		const { action, codemark } = this.props;
		const forceThreadId = codemark.parentPostId || codemark.postId;
		action("submit-post", null, { forceStreamId: codemark.streamId, forceThreadId, text });
	};

	renderStatus(codemark) {
		const { type, status = "open" } = codemark;
		if (type === CodemarkType.Issue) {
			if (this.props.inline) {
				return (
					<div
						className={cx("resolve-button", { checked: status === "closed" })}
						onClick={this.handleClickStatusToggle}
					>
						{status === "open" ? "Resolve" : "Reopen"}
					</div>
				);
			} else {
				return (
					<div className="align-far-left">
						<div
							className={cx("status-button", { checked: status === "closed" })}
							onClick={this.handleClickStatusToggle}
						>
							<Icon name="check" className="check" />
						</div>
					</div>
				);
			}
		}
		return null;
	}

	handleClickCodemark = (event: React.SyntheticEvent): any => {
		event.preventDefault();
		if (event && event.currentTarget && event.currentTarget.tagName === "A") return false;
		if (this.props.selected) return false;

		if (window.getSelection().toString().length > 0) {
			// in this case the user has selected a string
			// by dragging
			return;
		}
		this.props.onClick && this.props.onClick(this.props.codemark, this.props.marker);
	};

	handleMouseEnterCodemark = (event: React.SyntheticEvent): any => {
		this.props.onMouseEnter && this.props.onMouseEnter(this.props.marker);
	};

	handleMouseLeaveCodemark = (event: React.SyntheticEvent): any => {
		this.props.onMouseLeave && this.props.onMouseLeave(this.props.marker);
	};

	handleMenuClick = event => {
		event.stopPropagation();
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target });
	};

	handleSelectMenu = action => {
		this.setState({ menuOpen: false });

		if (!action) return;

		switch (action) {
			case "toggle-pinned":
				this.togglePinned();
				break;
		}
		var found = action.match(/set-keybinding-(\d)/);
		if (found) this.setKeybinding(found[1]);
	};

	togglePinned = () => {
		const { codemark } = this.props;
		if (!codemark) return;

		HostApi.instance.send(SetCodemarkPinnedRequestType, {
			codemarkId: codemark.id,
			value: !codemark.pinned
		});
	};

	toggleLabelIndicators = event => {
		event.stopPropagation();
		HostApi.instance.send(UpdateConfigurationRequestType, {
			name: "showLabelText",
			value: !this.props.showLabelText
		});
		this.setState({ showLabelText: !this.state.showLabelText });
	};

	renderCollapsedCodemark() {
		const { codemark, inline, selected } = this.props;
		const file = codemark.markers && codemark.markers[0].file;

		if (!codemark) return null;

		return (
			<div
				style={{ ...this.props.style }}
				className={cx("codemark collapsed")}
				onClick={this.handleClickCodemark}
				onMouseEnter={this.handleMouseEnterCodemark}
				onMouseLeave={this.handleMouseLeaveCodemark}
			>
				<div className="contents">
					{this.renderStatus(codemark)}
					<div className="body">
						<span className={codemark.color}>{this.renderTypeIcon()}</span>
						{this.renderTextLinkified(codemark.title || codemark.text)}
						{file && <span className="file-name">{file}</span>}
					</div>
				</div>
			</div>
		);
	}

	setKeybinding(key) {
		const { codemark, codemarkKeybindings } = this.props;
		Object.keys(codemarkKeybindings).forEach(key => {
			if (codemarkKeybindings[key] === codemark.id) codemarkKeybindings[key] = "";
		});
		codemarkKeybindings[key] = codemark.id;
		this.props.setUserPreference(["codemarkKeybindings"], codemarkKeybindings);
	}

	renderKeybinding(codemark) {
		const { codemarkKeybindings } = this.props;

		const index = Object.keys(codemarkKeybindings).find(
			key => codemarkKeybindings[key] === codemark.id
		);
		if (parseInt(index || "", 10) > 0) {
			const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";
			return (
				<div style={{ float: "right", marginRight: "5px", opacity: 0.6 }}>
					<span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding extra-pad">{index}</span>
				</div>
			);
		} else return null;
	}

	renderInlineCodemark() {
		const { codemark, inline, selected } = this.props;
		const { menuOpen, menuTarget } = this.state;
		const file = codemark.markers && codemark.markers[0].file;

		const user = {
			username: "pez",
			email: "pez@codestream.com",
			fullName: "Peter Pezaris"
		};

		if (!codemark) return null;

		const type = codemark && codemark.type;

		const mine = codemark.creatorId === this.props.currentUser.id;

		let menuItems: any[] = [
			// { label: "Add Reaction", action: "react" },
			// { label: "Get Permalink", action: "get-permalink" },
			// { label: "-" }
		];

		if (codemark.pinned) {
			menuItems.push({ label: "Archive", action: "toggle-pinned" });
		} else {
			menuItems.push({ label: "Unarchive", action: "toggle-pinned" });
		}

		if (mine) {
			menuItems.push(
				{ label: "Edit", action: "edit-post" },
				{ label: "Delete", action: "delete-post" }
			);
		}

		range(1, 10).forEach(index => {
			menuItems.push({ label: `Set Keybinding ${index}`, action: `set-keybinding-${index}` });
		});

		return (
			<div
				style={{ ...this.props.style }}
				className={cx("codemark collapsed inline type-" + type, { selected: selected })}
				onClick={this.handleClickCodemark}
				onMouseEnter={this.handleMouseEnterCodemark}
				onMouseLeave={this.handleMouseLeaveCodemark}
				data-linenum={this.props.lineNum}
				data-top={this.props.top}
			>
				<div className="contents">
					<div className="body">
						{this.renderKeybinding(codemark)}
						{this.renderStatus(codemark)}
						<div className="author">
							<Headshot person={user} /> <span className="author">{user.username}</span>
							<Timestamp time={codemark.createdAt} />
							{codemark.color && (
								<div
									className={cx(`label-indicator ${codemark.color}-background`, {
										expanded: this.state.showLabelText
									})}
									onClick={this.toggleLabelIndicators}
								>
									<span>priority</span>
								</div>
							)}
						</div>
						{type === "bookmark" && <span className={codemark.color}>{this.renderTypeIcon()}</span>}
						{this.renderTextLinkified(codemark.title || codemark.text)}
						<div
							style={{ position: "absolute", top: "5px", right: "5px" }}
							onClick={this.handleMenuClick}
						>
							{menuOpen && (
								<Menu items={menuItems} target={menuTarget} action={this.handleSelectMenu} />
							)}
							<Icon name="kebab-vertical" className="kebab-vertical clickable" />
						</div>
						{this.renderDemoShit(codemark, user)}
					</div>
					{selected && <CodemarkDetails codemark={codemark} />}
				</div>
			</div>
		);
	}

	renderDemoShit(codemark, user) {
		return (
			<div>
				{codemark.text &&
					codemark.text.startsWith("does this") && [
						<div className="pinned-reply">
							<Icon name="star" /> <Headshot size={18} person={user} />
							<div className="pinned-reply-body">
								no; the javascript byte compiler optimizes it away
							</div>
						</div>,
						<div className="pinned-reply">
							<Icon name="star" /> <Headshot size={18} person={user} />
							<div className="pinned-reply-body">are you sure?</div>
						</div>
					]}
				{codemark.title && codemark.title.startsWith("let's avoid") && (
					<div className="pinned-reply">
						<Icon name="star" /> <Headshot size={18} person={user} />
						<div className="pinned-reply-body">i'll grab this in the next sprint</div>
					</div>
				)}
				{codemark.text && codemark.text.startsWith("how does") && (
					<div className="pinned-reply">
						<Icon name="star" /> <Headshot size={18} person={user} />
						<div className="pinned-reply-body">
							Sample <code>n</code> random values from a collection using the modern version of the{" "}
							<b>Fisher-Yates</b> shuffle. If <code>n</code> is not specified, returns a single
							random element. The internal <code>guard</code> argument allows it to work with{" "}
							<code>map</code>.
						</div>
					</div>
				)}
			</div>
		);
	}
}

const EMPTY_OBJECT = {};

const mapStateToProps = (state, props) => {
	const { preferences, users, session } = state;
	return {
		currentUser: users[session.userId],
		codemarkKeybindings: preferences.codemarkKeybindings || EMPTY_OBJECT
	};
};

export default connect(
	mapStateToProps,
	{ setCodemarkStatus, setUserPreference }
)(Codemark);
