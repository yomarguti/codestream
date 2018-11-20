/* eslint-disable */
import cx from "classnames";
import * as React from "react";
import { connect } from "react-redux";
import { Action } from "redux";
import { setCodemarkStatus } from "./actions";
import Icon from "./Icon";
// import Debug from "./Debug";
import { markdownify } from "./Markdowner";

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
	codemark: CodemarkEntity;
	currentUserName: string;
	usernames: string[];
	setCodemarkStatus(id: string, status: string): Action;
	action(action: string, post: any, args: any): any;
	onClick?(CodemarkEntity): any;
}

export class Codemark extends React.Component<Props, State> {
	// shouldComponentUpdate(nextProps) {
	// 	const codemarkChanged = nextProps.codemark.version !== this.props.codemark.version;
	// 	const usernamesChanged =
	// 		nextProps.usernames.length !== this.props.usernames.length ||
	// 		nextProps.usernames.some(username => !this.props.usernames.includes(username));
	// 	return codemarkChanged || usernamesChanged;
	// }

	// componentDidUpdate(prevProps, prevState) {
	// 	const name = "Codemark";
	// 	console.group(name);
	// 	console.debug("props", { prevProps, currProps: this.props });
	// 	Object.keys(prevProps).forEach(key => {
	// 		if (prevProps[key] !== this.props[key]) {
	// 			console.log(`property ${key} changed from ${prevProps[key]} to ${this.props[key]}`);
	// 		}
	// 	});
	// 	console.groupEnd();
	// }

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

			// if (this.props.q) {
			// 	const matchQueryRegexp = new RegExp(this.props.q, "g");
			// 	html = html.replace(matchQueryRegexp, "<u><b>$&</b></u>");
			// }
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

	renderCollapsedCodemark() {
		const { codemark } = this.props;
		const file = codemark.markers && codemark.markers[0].file;
		return (
			<div className={cx("codemark collapsed", codemark.color)} onClick={this.handleClickCodemark}>
				{this.renderStatus(codemark)}
				<div className="body">
					{this.renderTypeIcon()}
					{this.renderTextLinkified(codemark.title || codemark.text)}
					{file && <span className="file-name">{file}</span>}
				</div>
			</div>
		);
	}
}

export default connect(
	null,
	{ setCodemarkStatus }
)(Codemark);
