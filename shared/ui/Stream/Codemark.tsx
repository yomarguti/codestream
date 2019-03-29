import cx from "classnames";
import React from "react";
import { connect } from "react-redux";
import { setCodemarkStatus } from "./actions";
import Headshot from "./Headshot";
import Icon from "./Icon";
import Menu from "./Menu";
import { markdownify } from "./Markdowner";
import Timestamp from "./Timestamp";
import CodemarkDetails from "./CodemarkDetails";
import { DocumentMarker } from "@codestream/protocols/agent";
import { CodemarkType } from "@codestream/protocols/api";
import { HostApi } from "../webview-api";
import { SetCodemarkPinnedRequestType } from "@codestream/protocols/agent";
import { UpdateConfigurationRequestType } from "@codestream/protocols/webview";
import { validateSignup } from "../Login/actions";

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
}
interface State {
	menuOpen?: boolean;
	menuTarget?: any;
	showLabelText: boolean;
}
interface Props {
	selected?: boolean;
	collapsed?: boolean;
	inline?: boolean;
	codemark: CodemarkEntity;
	marker: DocumentMarker;
	currentUserName: string;
	currentUserId?: string;
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
		if (this.props.collapsed) return this.renderCollapsedCodemark();
		else return null;
	}

	renderTextLinkified = text => {
		let html;
		if (text == null || text === "") {
			html = "";
		} else {
			const me = this.props.currentUserName.toLowerCase();
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

		switch (action) {
			case "toggle-pinned":
				this.togglePinned();
				break;
		}
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
		const { menuOpen, menuTarget } = this.state;
		const file = codemark.markers && codemark.markers[0].file;

		const user = {
			username: "pez",
			email: "pez@codestream.com",
			fullName: "Peter Pezaris"
		};

		if (!codemark) return null;

		const type = codemark && codemark.type;

		const mine = codemark.creatorId === this.props.currentUserId;

		let menuItems: any[] = [
			// { label: "View Details", action: "open-codemark" },
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

		// console.log(codemark);
		// const style = inline ?
		return (
			<div
				style={{ ...this.props.style }}
				className={cx("codemark collapsed", { inline: inline, selected: selected })}
				onClick={this.handleClickCodemark}
				onMouseEnter={this.handleMouseEnterCodemark}
				onMouseLeave={this.handleMouseLeaveCodemark}
				data-linenum={this.props.lineNum}
				data-top={this.props.top}
			>
				<div className="contents">
					{this.renderStatus(codemark)}
					<div className="body">
						{inline && (
							<div className="author">
								<Headshot person={user} /> <span className="author">{user.username}</span>
								<Timestamp time={codemark.createdAt} />
								{inline && codemark.color && (
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
						)}
						{!inline && <span className={codemark.color}>{this.renderTypeIcon()}</span>}
						{this.renderTextLinkified(codemark.title || codemark.text)}
						{file && !inline && <span className="file-name">{file}</span>}
						{inline && (
							<div
								style={{ position: "absolute", top: "5px", right: "5px" }}
								onClick={this.handleMenuClick}
							>
								{menuOpen && (
									<Menu items={menuItems} target={menuTarget} action={this.handleSelectMenu} />
								)}
								<Icon name="kebab-vertical" className="kebab-vertical clickable" />
							</div>
						)}
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
				{codemark.text && codemark.text.startsWith("does this") && (
					<div>
						<div className="angle-arrow" />
						{<Headshot size={18} person={user} />}
						<span style={{ opacity: 0.5 }}>no; the javascript byte compiler optimizes it away</span>
					</div>
				)}
				{codemark.title && codemark.title.startsWith("let's avoid") && (
					<div>
						<div className="angle-arrow" />
						{<Headshot size={18} person={user} />}
						<span style={{ opacity: 0.5 }}>i'll grab this in the next sprint</span>
					</div>
				)}
				{codemark.text && codemark.text.startsWith("how does") && (
					<div>
						<div className="angle-arrow" />
						{<Headshot size={18} person={user} />}
						<div style={{ opacity: 0.5, paddingLeft: "47px", marginTop: "-19px" }}>
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

// please do not remove this commented-out code, as i occasionally put it back in
// to do demos & screen grabs -Pez
// {codemark.text && codemark.text.startsWith("does this") && (
// 	<div>
// 		<div className="angle-arrow" />
// 		{<Headshot size={18} person={user} />}
// 		<span style={{ opacity: 0.5 }}>
// 			no; the javascript byte compiler optimizes it away
// 		</span>
// 	</div>
// )}
// {codemark.title && codemark.title.startsWith("let's avoid") && (
// 	<div>
// 		<div className="angle-arrow" />
// 		{<Headshot size={18} person={user} />}
// 		<span style={{ opacity: 0.5 }}>i'll grab this in the next sprint</span>
// 	</div>
// )}
// {codemark.text && codemark.text.startsWith("how does") && (
// 	<div>
// 		<div className="angle-arrow" />
// 		{<Headshot size={18} person={user} />}
// 		<div style={{ opacity: 0.5, paddingLeft: "47px", marginTop: "-19px" }}>
// 			Sample <code>n</code> random values from a collection using the modern version of
// 			the <b>Fisher-Yates</b> shuffle. If <code>n</code> is not specified, returns a
// 			single random element. The internal <code>guard</code> argument allows it to work
// 			with <code>map</code>.
// 		</div>
// 	</div>
// )}

export default connect(
	null,
	{ setCodemarkStatus }
)(Codemark);
