import React from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import { PostCompose } from "./PostCompose";
import { CodemarkForm } from "./CodemarkForm";
// import hljs from "highlight.js";
// const Path = require("path");
import { MessageInput } from "./MessageInput";

class ComposeBox extends React.Component {
	state = {
		crossPostMessage: true,
		crossPostIssue: true,
		startPosition: document.body.getBoundingClientRect().height / 3
	};

	componentDidMount() {
		this.repositionIfNecessary();
	}

	repositionIfNecessary() {
		const { forwardedRef, quote, textEditorVisibleRanges } = this.props;

		const root = forwardedRef.current;
		if (!root) return;
		const bodyDimensions = document.body.getBoundingClientRect();
		const rootDimensions = root.getBoundingClientRect();

		let top;
		if (false && quote && quote.range && textEditorVisibleRanges.length) {
			// const quoteLineNum = quote.location[0];
			// let numLinesVisible = 0;
			// textEditorVisibleRanges.forEach(range => {
			// 	numLinesVisible += range[1].line - range[0].line + 1;
			// });
			// numLinesVisible += 1; // vscode mis-reports the last line as being 2 bigger than it is
			//
			// let rangeStartOffset = 0;
			// textEditorVisibleRanges.forEach(lineRange => {
			// 	const rangeFirstLine = lineRange[0].line;
			// 	const rangeLastLine = lineRange[1].line;
			// 	const linesInRange = rangeLastLine - rangeFirstLine + 1;
			// 	if (quoteLineNum >= rangeFirstLine && quoteLineNum < rangeLastLine)
			// 		top = (100 * (rangeStartOffset + quoteLineNum - rangeFirstLine)) / numLinesVisible;
			// 	rangeStartOffset += linesInRange;
			// });
			// if ((top * bodyDimensions.height) / 100 + rootDimensions.height > bodyDimensions.height - 10)
			// 	top = bodyDimensions.height - rootDimensions.height - 10;
			// else top = top + "vh";
		} else {
			top = (bodyDimensions.height - rootDimensions.height) / 2;
		}

		this.setState(state => {
			if (top !== state.startPosition) {
				return { startPosition: top };
			} else return null;
		});

		//FIXME -- check to see if it's too low
	}

	handleSubmitPost = (...args) => {
		if (this.props.disabled) return;
		this.props.onSubmitPost(...args);
	};

	submitCodemarkPost = (attributes, event) => {
		if (this.props.disabled) return;

		let newPostText = attributes.text || "";

		// convert the text to plaintext so there is no HTML
		const domParser = new DOMParser();
		const replaceRegex = /<br>|<div>/g;
		const text = domParser.parseFromString(newPostText.replace(replaceRegex, "\n"), "text/html")
			.documentElement.textContent;
		const title =
			attributes.title &&
			domParser.parseFromString(attributes.title.replace(replaceRegex, "\n"), "text/html")
				.documentElement.textContent;

		const { streamId, assignees, color, type, crossPostIssueValues } = attributes;

		this.props.onSubmitCodemark(
			{
				title,
				text,
				streamId,
				type,
				assignees,
				color
			},
			crossPostIssueValues
		);

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
		// this.focus();
		// this.reset();
	};

	handleClickDismissQuote = event => {
		if (event) event.preventDefault();
		this.setState({ quote: null });
	};

	resetFields = clearOutTextToo => {
		if (clearOutTextToo) {
		}
	};

	softReset = () => {
		this.resetFields(true);
		// this.focus();
	};

	// TODO: delete
	reset() {
		this.setState({
			postTextByStream: {}
		});
	}

	openMultiCompose = type => {
		this.props.setMultiCompose(true, {
			composeBoxProps: {
				commentType: type
			}
		});
		this.props.setNewPostEntry("Stream");
		// setTimeout(() => {
		// 	this.focus();
		// }, 20);
	};

	setCommentType = type => {
		if (this.props.isEditing) return;
		this.setState({
			commentType: type,
			codeBlockInvalid: false,
			titleInvalid: false,
			textInvalid: false
		});
		// setTimeout(() => {
		// 	this.focus();
		// }, 20);
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

		return (
			<div
				ref={forwardedRef}
				className={createClassString("compose", {
					offscreen: this.props.offscreen,
					"popup-open": this.state.popupOpen,
					"float-compose": this.props.floatCompose,
					"multi-compose": multiCompose
				})}
				style={{ top: this.state.startPosition }}
			>
				<div style={{ position: "relative" }}>
					{multiCompose ? (
						<CodemarkForm
							channelStreams={this.props.channelStreams}
							directMessageStreams={this.props.directMessageStreams}
							collapseForm={() => this.props.setMultiCompose("collapse")}
							onClickClose={this.handleClickDismissMultiCompose}
							streamId={this.props.streamId}
							onSubmit={this.submitCodemarkPost}
							renderMessageInput={this.renderMessageInput}
							teammates={this.props.teammates}
							collapsed={false}
							openCodemarkForm={this.openMultiCompose}
							placeholder={this.props.placeholder}
							currentUserId={this.props.currentUserId}
							editingCodemark={this.props.editingCodemark}
							commentType={this.props.commentType}
						/>
					) : (
						<PostCompose
							onClickClose={this.handleClickDismissMultiCompose}
							openCodemarkForm={this.openMultiCompose}
							openDirection={this.props.floatCompose ? "down" : "up"}
							renderMessageInput={this.renderMessageInput}
							onSubmit={this.handleSubmitPost}
							placeholder={this.props.placeholder}
						/>
					)}
				</div>
			</div>
		);
	}
}

const emptyArray = [];

const mapStateToProps = state => {
	return { textEditorVisibleRanges: state.context.textEditorVisibleRanges || emptyArray };
};

const ConnectedComposeBox = connect(mapStateToProps)(ComposeBox);

export default React.forwardRef((props, ref) => (
	<ConnectedComposeBox {...props} forwardedRef={ref} />
));
