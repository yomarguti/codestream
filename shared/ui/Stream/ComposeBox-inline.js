import _ from "underscore";
import React from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import { PostCompose } from "./PostCompose";
import { CodemarkForm } from "./CodemarkForm";
import Icon from "./Icon";
import Menu from "./Menu";
import { getCurrentCursorPosition, arrayToRange } from "../utils";
// import hljs from "highlight.js";
// const Path = require("path");
import { createServiceCard } from "./actions";
import { MessageInput } from "./MessageInput";

class ComposeBox extends React.Component {
	state = {
		crossPostMessage: true,
		crossPostIssue: true
	};

	componentDidUpdate(prevProps, prevState) {
		const { multiCompose } = this.props;

		if (prevProps.multiCompose !== multiCompose) {
			// requestAnimationFrame(() => {
			// 	this.focus();
			// });
		}
	}

	submitPlainPost = newPostText => {
		const domParser = new DOMParser();
		const replaceRegex = /<br>|<div>/g;
		const text = domParser.parseFromString(newPostText.replace(replaceRegex, "\n"), "text/html")
			.documentElement.textContent;
		const mentionedUserIds = this.props.findMentionedUserIds(text, this.props.teammates);
		this.props.onSubmit({ text, mentionedUserIds });
	};

	submitCodemarkPost = (attributes, event) => {
		const { quote, streamId } = this.props;
		let newPostText = attributes.text || "";

		// convert the text to plaintext so there is no HTML
		const domParser = new DOMParser();
		const replaceRegex = /<br>|<div>/g;
		const text = domParser.parseFromString(newPostText.replace(replaceRegex, "\n"), "text/html")
			.documentElement.textContent;
		const title = domParser.parseFromString(
			attributes.title.replace(replaceRegex, "\n"),
			"text/html"
		).documentElement.textContent;
		const mentionedUserIds = this.props.findMentionedUserIds(text, this.props.teammates);

		const { assignees, color, type } = attributes;

		if (this.props.disabled) return;

		// don't submit blank posts
		if (newPostText.trim().length === 0 && title.length === 0) return;

		const assigneeIds = (assignees || [])
			.map(item => {
				return item.value;
			})
			.filter(Boolean);

		this.props.onSubmit({
			text: "",
			title,
			quote,
			mentionedUserIds,
			autoMentions: attributes.autoMentions,
			forceStreamId: streamId,
			codemark: {
				title,
				text,
				streamId,
				type,
				assignees: assigneeIds || [],
				color: color || ""
			}
		});

		const { crossPostIssueValues } = this;
		if (type === "issue" && crossPostIssueValues && crossPostIssueValues.isEnabled) {
			let description = text + "\n\n";
			if (quote) description += "In " + quote.file + "\n\n```\n" + quote.code + "\n```\n\n";
			description += "Posted via CodeStream";

			this.props.createServiceCard({ ...crossPostIssueValues, title, description });
		}

		if (event && event.metaKey) this.softReset();
		else {
			this.reset();
			this.handleClickDismissMultiCompose();
		}
	};

	handleClickDismissMultiCompose = event => {
		if (event) event.preventDefault();
		this.resetFields();
		this.props.setMultiCompose(false);
		this.focus();
		// this.reset();
	};

	handleClickDismissQuote = event => {
		if (event) event.preventDefault();
		this.setState({ quote: null });
	};

	resetFields = clearOutTextToo => {
		if (clearOutTextToo) {
		}
		this.setState({
			autoMentions: []
		});
	};

	softReset = () => {
		this.resetFields(true);
		this.focus();
	};

	// TODO: delete
	reset() {
		this.setState({
			postTextByStream: {}
		});
	}

	openMultiCompose = () => {
		this.props.setMultiCompose("comment");
		setTimeout(() => {
			this.focus();
		}, 20);
	};

	setCommentType = type => {
		if (this.props.isEditing) return;
		this.setState({
			commentType: type,
			codeBlockInvalid: false,
			titleInvalid: false,
			textInvalid: false
		});
		setTimeout(() => {
			this.focus();
		}, 20);
	};

	handleCrossPostIssueValues = values => {
		this.crossPostIssueValues = values;
	};

	switchChannel = event => {
		event.stopPropagation();
		this.setState({
			channelMenuOpen: !this.state.channelMenuOpen,
			channelMenuTarget: event.target,
			crossPostMessage: true
		});
	};

	menuAction = arg => {
		this.setState({ menuOpen: false });
		if (arg) this.setCommentType(arg);
	};

	toggleMenu = event => {
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target });
	};

	// renderCode(quote) {
	// 	const path = quote.file;
	// 	let extension = Path.extname(path).toLowerCase();
	// 	if (extension.startsWith(".")) {
	// 		extension = extension.substring(1);
	// 	}
	// 	const codeHTML = extension
	// 		? hljs.highlight(extension, quote.code).value
	// 		: hljs.highlightAuto(quote.code).value;
	//
	// 	return <div className="code" dangerouslySetInnerHTML={{ __html: codeHTML }} />;
	// }

	tabIndex = () => {
		return global.atom ? this.tabIndexCount++ : "0";
	};

	renderMessageInput = props => {
		return (
			<MessageInput
				teammates={this.props.teammates}
				currentUserId={this.props.currentUserId}
				slashCommands={this.props.slashCommands}
				services={this.props.services}
				channelStreams={this.props.channelStreams}
				isSlackTeam={this.props.isSlackTeam}
				isDirectMessage={this.props.isDirectMessage}
				onEmptyUpArrow={this.props.onEmptyUpArrow}
				onDismiss={this.handleClickDismissMultiCompose}
				tabIndex={this.tabIndex()}
				quotePost={this.props.quotePost}
				{...props}
			/>
		);
	};

	render() {
		const { forwardedRef, multiCompose, quote } = this.props;

		this.tabIndexCount = 0;

		let range = quote ? arrayToRange(quote.location) : { start: { row: 20 } }; // 20 is a placeholder to attempt to bring the element towards the middle of the screen
		let style = undefined;
		if (range) style = { top: 18 * range.start.row + 15 };

		return (
			<div
				ref={forwardedRef}
				className={createClassString("compose", {
					offscreen: this.props.offscreen,
					"popup-open": this.state.popupOpen,
					"float-compose": this.props.floatCompose,
					"multi-compose": multiCompose
				})}
				style={style}
			>
				<div style={{ position: "relative" }}>
					{multiCompose ? (
						<CodemarkForm
							channelStreams={this.props.channelStreams}
							directMessageStreams={this.props.directMessageStreams}
							collapseForm={() => this.props.setMultiCompose("collapse")}
							onClickClose={this.handleClickDismissMultiCompose}
							streamId={this.props.streamId}
							onCrossPostIssueValues={this.handleCrossPostIssueValues}
							onSubmit={this.submitCodemarkPost}
							codeBlock={quote}
							renderMessageInput={this.renderMessageInput}
							teammates={this.props.teammates}
							collapsed={false}
							openCodemarkForm={this.openMultiCompose}
							placeholder={this.props.placeholder}
							currentUserId={this.props.currentUserId}
							editingCodemark={this.props.editingCodemark}
						/>
					) : (
						<PostCompose
							onClickClose={this.handleClickDismissMultiCompose}
							openCodemarkForm={this.openMultiCompose}
							openDirection={this.props.floatCompose ? "down" : "up"}
							renderMessageInput={this.renderMessageInput}
							onSubmit={this.submitPlainPost}
							placeholder={this.props.placeholder}
						/>
					)}
				</div>
			</div>
		);
	}
}

const ConnectedComposeBox = connect(
	null,
	{ createServiceCard }
)(ComposeBox);

export default React.forwardRef((props, ref) => (
	<ConnectedComposeBox {...props} forwardedRef={ref} />
));
