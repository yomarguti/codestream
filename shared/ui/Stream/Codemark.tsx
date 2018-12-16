import cx from "classnames";
import * as React from "react";
import { connect } from "react-redux";
import { setCodemarkStatus } from "./actions";
import Headshot from "./Headshot";
import Icon from "./Icon";
import { markdownify } from "./Markdowner";
import Timestamp from "./Timestamp";

enum Type {
	Comment = "comment",
	Issue = "issue",
	Question = "question",
	Bookmark = "bookmark",
	Trap = "trap"
}

interface CodemarkEntity {
	id: string;
	color: string;
	type: Type;
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
}
interface State {}
interface Props {
	collapsed?: boolean;
	inline?: boolean;
	textEditorFirstLine?: number;
	codemark: CodemarkEntity;
	currentUserName: string;
	usernames: string[];
	setCodemarkStatus: typeof setCodemarkStatus;
	action(action: string, post: any, args: any): any;
	onClick?(CodemarkEntity): any;
	onMouseEnter?(CodemarkEntity): any;
	onMouseLeave?(CodemarkEntity): any;
	query?: string;
}

export class Codemark extends React.Component<Props, State> {
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
	}

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
	}

	closeIssue = () => {
		const { codemark, setCodemarkStatus } = this.props;
		setCodemarkStatus(codemark.id, "closed");
		this.submitReply("/me closed this issue");
	}

	openIssue = () => {
		const { codemark, setCodemarkStatus } = this.props;
		setCodemarkStatus(codemark.id, "open");
		this.submitReply("/me reopened this issue");
	}

	submitReply = text => {
		const { action, codemark } = this.props;
		const forceThreadId = codemark.parentPostId || codemark.postId;
		action("submit-post", null, { forceStreamId: codemark.streamId, forceThreadId, text });
	}

	renderStatus(codemark) {
		const { type, status = "open" } = codemark;
		if (type === Type.Issue) {
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

		if (window.getSelection().toString().length > 0) {
			// in this case the user has selected a string
			// by dragging
			return;
		}
		this.props.onClick && this.props.onClick(this.props.codemark);
	}

	handleMouseEnterCodemark = (event: React.SyntheticEvent): any => {
		this.props.onMouseEnter && this.props.onMouseEnter(this.props.codemark);
	}

	handleMouseLeaveCodemark = (event: React.SyntheticEvent): any => {
		this.props.onMouseLeave && this.props.onMouseLeave(this.props.codemark);
	}

	renderCollapsedCodemark() {
		const { codemark, inline, textEditorFirstLine = 0 } = this.props;
		const file = codemark.markers && codemark.markers[0].file;
		// const startLine = codemark.markers && codemark.markers[0].location[0];
		let top = 0;
		if (codemark.markers) {
			const marker = codemark.markers[0];
			if (marker) {
				const location = marker.location || marker.locationWhenCreated;
				if (location) top = 18 * (location[0] - textEditorFirstLine) - 3;
			}
		}

		const user = {
			username: "pez",
			email: "pez@codestream.com",
			fullName: "Peter Pezaris"
		};

		// console.log(codemark);
		// const style = inline ?
		return (
			<div
				style={{ top, zIndex: 2 }}
				className={cx("codemark collapsed", codemark.color, { inline })}
				onClick={this.handleClickCodemark}
				onMouseEnter={this.handleMouseEnterCodemark}
				onMouseLeave={this.handleMouseLeaveCodemark}
			>
				{this.renderStatus(codemark)}
				<div className="body">
					{this.renderTypeIcon()}
					{this.renderTextLinkified(codemark.title || codemark.text)}
					{file && !inline && <span className="file-name">{file}</span>}
					{inline && (
						<div className="show-on-hover">
							<div className="angle-arrow" />
							{<Headshot size={18} person={user} />}
							<span className="username">pez</span> posted to{" "}
							<span className="clickable">#test</span> &middot;{" "}
							<span className="clickable">2 replies</span> &middot;
							<Timestamp time={codemark.createdAt} />
						</div>
					)}
				</div>
			</div>
		);
	}
}

export default connect(
	null,
	{ setCodemarkStatus }
)(Codemark);
