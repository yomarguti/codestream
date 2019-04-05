import React from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import { PostCompose } from "./PostCompose";
import { CodemarkForm } from "./CodemarkForm";
import { MessageInput } from "./MessageInput";
import {
	getLine0ForEditorLine,
	getVisibleLineCount,
	getVisibleRanges
} from "../store/editorContext/reducer";

class ComposeBox extends React.Component {
	state = {
		crossPostMessage: true,
		crossPostIssue: true,
		position: document.body.getBoundingClientRect().height / 3 // TODO: try to avoid `getBoundingClientRect`
	};

	static getDerivedStateFromProps(props, state) {
		const { codeBlock, textEditorVisibleRanges } = props;
		if (!props.codeBlock) return null;

		const line0 = getLine0ForEditorLine(textEditorVisibleRanges, codeBlock.range.start.line);
		if (line0 >= 0) {
			const top = (window.innerHeight * line0) / getVisibleLineCount(textEditorVisibleRanges);
			if (top !== state.position) return { position: top };
		}
		//FIXME -- check to see if it's too low
		return null;
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
			crossPostIssueValues,
			attributes.codeBlock
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
			commentType: type
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

	// TODO: remove this
	tabIndex = () => {
		return "0";
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
				height={this.props.height}
				{...props}
			/>
		);
	};

	render() {
		const { forwardedRef, multiCompose, top } = this.props;

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
				style={{ top: this.state.position }}
				data-top={top}
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
							codeBlock={this.props.codeBlock}
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

const mapStateToProps = state => {
	return { textEditorVisibleRanges: getVisibleRanges(state.editorContext) };
};

const ConnectedComposeBox = connect(mapStateToProps)(ComposeBox);

export default React.forwardRef((props, ref) => (
	<ConnectedComposeBox {...props} forwardedRef={ref} />
));
