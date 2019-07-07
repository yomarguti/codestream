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
import { setNewPostEntry } from "../store/context/actions";

class ComposeBox extends React.Component {
	state = {
		crossPostMessage: true,
		crossPostIssue: true,
		position: document.body.getBoundingClientRect().height / 3 // TODO: try to avoid `getBoundingClientRect`
	};

	static getDerivedStateFromProps(props, state) {
		const { textEditorVisibleRanges, forwardedRef } = props;
		if (!props.codeBlock) return null;

		const startLine = state.selectionCursor
			? state.selectionCursor
			: props.codeBlock.range.start.line;

		const line0 = getLine0ForEditorLine(textEditorVisibleRanges, startLine);
		if (line0 >= 0) {
			let top = (window.innerHeight * line0) / getVisibleLineCount(textEditorVisibleRanges);
			if (state.adjustedPosition) {
				if (top <= state.adjustedPosition) return { position: top, adjustedPosition: undefined };
				if (forwardedRef.current.getBoundingClientRect().bottom < top) {
					return { position: top, adjustedPosition: undefined };
				}
			}
			if (top !== state.position) {
				return { position: top };
			}
		} else {
			return { position: 100000 };
		}
		return null;
	}

	componentDidMount() {
		this.repositionIfNecessary();
	}

	repositionIfNecessary() {
		const { forwardedRef } = this.props;
		if (!forwardedRef) return null;

		const domRect = forwardedRef.current.getBoundingClientRect();
		const bodyRect = document.body.getBoundingClientRect();
		// adjust if it's too low
		if (domRect.bottom >= bodyRect.bottom) {
			const { position } = this.state;
			const nextPosition = position - (domRect.bottom - bodyRect.bottom + 120);
			if (nextPosition !== position)
				return this.setState({
					adjustedPosition: nextPosition
				});
		}
	}

	onSelectionChange = range => {
		this.setState({ selectionCursor: range.cursor.line });
	};

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

		this.props.onSubmitCodemark(
			{
				title,
				text,
				streamId: attributes.streamId,
				type: attributes.type,
				assignees: attributes.assignees,
				tags: attributes.tags,
				relatedCodemarkIds: attributes.relatedCodemarkIds
			},
			attributes.crossPostIssueValues,
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

	renderMessageInput = props => {
		return (
			<MessageInput
				teammates={this.props.teammates}
				currentUserId={this.props.currentUserId}
				slashCommands={this.props.slashCommands}
				services={this.props.services}
				channelStreams={this.props.channelStreams}
				teamProvider={this.props.teamProvider}
				isDirectMessage={this.props.isDirectMessage}
				onEmptyUpArrow={this.props.onEmptyUpArrow}
				onDismiss={this.handleClickDismissMultiCompose}
				quotePost={this.props.quotePost}
				height={this.props.height}
				{...props}
			/>
		);
	};

	render() {
		const { forwardedRef, multiCompose } = this.props;

		return (
			<div
				ref={forwardedRef}
				className={createClassString("compose", {
					offscreen: this.props.offscreen,
					"popup-open": this.state.popupOpen,
					"float-compose": this.props.floatCompose,
					"multi-compose": multiCompose
				})}
				style={{ top: this.state.adjustedPosition || this.state.position }}
				data-top={this.state.adjustedPosition || this.state.position}
			>
				<div style={{ position: "relative" }}>
					{multiCompose ? (
						<CodemarkForm
							onClickClose={this.handleClickDismissMultiCompose}
							isEditing={this.props.isEditing}
							streamId={this.props.streamId}
							onSubmit={this.submitCodemarkPost}
							collapsed={false}
							placeholder={this.props.placeholder}
							editingCodemark={this.props.editingCodemark}
							commentType={this.props.commentType}
							codeBlock={this.props.codeBlock}
							onDidChangeSelection={this.onSelectionChange}
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

const ConnectedComposeBox = connect(
	mapStateToProps,
	{ setNewPostEntry }
)(ComposeBox);

export default React.forwardRef((props, ref) => (
	<ConnectedComposeBox {...props} forwardedRef={ref} />
));
