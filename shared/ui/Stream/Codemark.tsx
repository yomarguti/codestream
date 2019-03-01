import cx from "classnames";
import React from "react";
import { connect } from "react-redux";
import { setCodemarkStatus } from "./actions";
import Headshot from "./Headshot";
import Icon from "./Icon";
import { markdownify } from "./Markdowner";
import Timestamp from "./Timestamp";
import { DocumentMarker } from "@codestream/protocols/agent";

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
	codemark: CodemarkEntity;
	marker: DocumentMarker;
	currentUserName: string;
	usernames: string[];
	setCodemarkStatus: Function;
	action(action: string, post: any, args: any): any;
	onClick?(codemark: CodemarkEntity): any;
	onMouseEnter?(marker: DocumentMarker): any;
	onMouseLeave?(marker: DocumentMarker): any;
	query?: string;
	style?: object;
	lineNum?: Number;
}

export class Codemark extends React.Component<Props, State> {
	static defaultProps = {
		style: {}
	};
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
	};

	handleMouseEnterCodemark = (event: React.SyntheticEvent): any => {
		this.props.onMouseEnter && this.props.onMouseEnter(this.props.marker);
	};

	handleMouseLeaveCodemark = (event: React.SyntheticEvent): any => {
		this.props.onMouseLeave && this.props.onMouseLeave(this.props.marker);
	};

	renderCollapsedCodemark() {
		const { codemark, inline } = this.props;
		const file = codemark.markers && codemark.markers[0].file;

		const user = {
			username: "pez",
			email: "pez@codestream.com",
			fullName: "Peter Pezaris"
		};

		// console.log(codemark);
		// const style = inline ?
		return (
			<div
				style={{ ...this.props.style }}
				className={cx("codemark collapsed", codemark.color, { inline })}
				onClick={this.handleClickCodemark}
				onMouseEnter={this.handleMouseEnterCodemark}
				onMouseLeave={this.handleMouseLeaveCodemark}
				data-linenum={this.props.lineNum}
			>
				{this.renderStatus(codemark)}
				<div className="body">
					{this.renderTypeIcon()}
					{this.renderTextLinkified(codemark.title || codemark.text)}
					{file && !inline && <span className="file-name">{file}</span>}
					{codemark.text && codemark.text.startsWith("does this") && (
						<div>
							<div className="angle-arrow" />
							{<Headshot size={18} person={user} />}
							<span style={{ opacity: 0.5 }}>
								no; the javascript byte compiler optimizes it away
							</span>
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
								Sample <code>n</code> random values from a collection using the modern version of
								the <b>Fisher-Yates</b> shuffle. If <code>n</code> is not specified, returns a
								single random element. The internal <code>guard</code> argument allows it to work
								with <code>map</code>.
							</div>
						</div>
					)}
					{inline && (
						<div className="show-on-hover" style={{ display: "none" }}>
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
