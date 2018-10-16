import _ from "underscore";
import React from "react";
import ContentEditable from "react-contenteditable";
import createClassString from "classnames";
import EventEmitter from "../event-emitter";
import AtMentionsPopup from "./AtMentionsPopup";
import Icon from "./Icon";
import Button from "./Button";
import EmojiPicker from "./EmojiPicker";
import { getCurrentCursorPosition, createRange } from "../utils";
const emojiData = require("../node_modules/markdown-it-emoji-mart/lib/data/full.json");
import Select from "react-select";
import Tooltip from "./Tooltip";
import hljs from "highlight.js";
const Path = require("path");

const arrayToRange = ([startRow, startCol, endRow, endCol]) => {
	return {
		start: {
			row: startRow,
			col: startCol
		},
		end: {
			row: endRow,
			col: endCol
		}
	};
};

class ComposeBox extends React.Component {
	state = {
		postTextByStream: {},
		quote: null,
		autoMentions: [],
		popupOpen: false,
		emojiOpen: false,
		commentType: "comment"
	};
	disposables = [];

	componentDidMount() {
		this.disposables.push(
			EventEmitter.subscribe("interaction:code-highlighted", this.handleCodeHighlightEvent)
		);

		// so that HTML doesn't get pasted into the input field. without this,
		// HTML would be rendered as HTML when pasted
		this._contentEditable.htmlEl.addEventListener("paste", function(e) {
			e.preventDefault();
			const text = e.clipboardData.getData("text/plain");
			document.execCommand("insertHTML", false, text.replace(/\n/g, "<br>"));
		});

		// because atom hijacks most keystroke events
		if (global.atom) {
			this.disposables.push(
				atom.commands.add("atom-workspace", {
					"codestream:focus-input": _event => this.focus()
				}),
				atom.commands.add(".codestream", "codestream:escape", {
					didDispatch: event => this.handleAtMentionKeyPress(event, "escape"),
					hiddenInCommandPalette: true
				}),
				atom.commands.add(".codestream .compose.popup-open", "codestream:popup-move-up", {
					didDispatch: event => this.handleAtMentionKeyPress(event, "up"),
					hiddenInCommandPalette: true
				}),
				atom.commands.add(".codestream .compose.popup-open", "codestream:popup-move-down", {
					didDispatch: event => this.handleAtMentionKeyPress(event, "down"),
					hiddenInCommandPalette: true
				}),
				atom.commands.add(".codestream .compose.popup-open", "codestream:popup-tab", {
					didDispatch: event => this.handleAtMentionKeyPress(event, "tab"),
					hiddenInCommandPalette: true
				}),
				atom.commands.add(".codestream .native-key-bindings", "codestream:move-up", {
					didDispatch: event => this.handleNonCapturedKeyPress(event, "up"),
					hiddenInCommandPalette: true
				})
			);
		}
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	componentDidUpdate(prevProps, prevState) {
		const { multiCompose } = this.props;

		if (prevProps.multiCompose !== multiCompose) {
			this.setState({ commentType: multiCompose === true ? "comment" : multiCompose });
			setTimeout(() => {
				this.focus();
			}, 20);
		}
	}

	handleCodeHighlightEvent = body => {
		// make sure we have a compose box to type into
		this.props.ensureStreamIsActive();
		this.setState({ quote: body });

		let mentions = [];
		if (body.source && body.source.authors) {
			mentions = body.source.authors.filter(author => author.id !== this.props.currentUserId);
		}

		if (mentions.length > 0) {
			// TODO handle users with no username
			const usernames = mentions.map(u => `@${u.username}`);
			this.setState({ autoMentions: usernames });
			// the reason for this unicode space is that chrome will
			// not render a space at the end of a contenteditable div
			// unless it is a &nbsp;, which is difficult to insert
			// so we insert this unicode character instead
			const newText = usernames.join(", ") + ":\u00A0";
			this.insertTextAtCursor(newText);
		}
	};

	insertIfEmpty(newText) {
		// if there's text in the compose area, return without
		// adding the suggestion
		if (
			this.state.postTextByStream[this.props.streamId] &&
			this.state.postTextByStream[this.props.streamId].length > 0
		)
			return;
		// the reason for this unicode space is that chrome will
		// not render a space at the end of a contenteditable div
		// unless it is a &nbsp;, which is difficult to insert
		// so we insert this unicode character instead
		this.insertTextAtCursor(newText + ":\u00A0");
	}

	focus = forceMainInput => {
		if (forceMainInput) return this._contentEditable.htmlEl.focus();

		switch (this.state.commentType) {
			case "question":
				this._titleInput.focus();
				break;
			case "issue":
				this._titleInput.focus();
				break;
			case "snippet":
				this._contentEditableSnippet.htmlEl.focus();
				break;
			default:
				this._contentEditable.htmlEl.focus();
		}
	};

	// set up the parameters to pass to the at mention popup
	showPopupSelectors(prefix, type) {
		let itemsToShow = [];

		// console.log("SERVICES: ", this.props.services);

		//filter out yourself

		if (type === "at-mentions") {
			const teammates = this.props.teammates.filter(({ id }) => id !== this.props.currentUserId);
			Object.values(teammates).forEach(person => {
				let toMatch = person.fullName + "*" + person.username;
				if (toMatch.toLowerCase().indexOf(prefix) !== -1) {
					itemsToShow.push({
						id: person.id,
						headshot: person,
						identifier: person.username || person.email,
						description: person.fullName
					});
				}
			});
		} else if (type === "slash-commands") {
			this.props.slashCommands.map(command => {
				if (command.channelOnly && this.props.isDirectMessage) return;
				if (command.requires && !this.props.services[command.requires]) return;
				if (command.codeStreamTeam && this.props.isSlackTeam) return;
				if (command.slackTeam && !this.props.isSlackTeam) return;
				let lowered = command.id.toLowerCase();
				if (lowered.indexOf(prefix) === 0) {
					command.identifier = command.id;
					itemsToShow.push(command);
				}
			});
		} else if (type === "channels") {
			Object.values(this.props.channelStreams).forEach(channel => {
				let toMatch = channel.name;
				if (toMatch.toLowerCase().indexOf(prefix) !== -1) {
					itemsToShow.push({
						id: channel.name,
						identifier: "#" + channel.name,
						description: channel.purpose
					});
				}
			});
		} else if (type === "emojis") {
			if (prefix && prefix.length > 1) {
				Object.keys(emojiData).map(emojiId => {
					if (emojiId.indexOf(prefix) === 0) {
						itemsToShow.push({ id: emojiId, identifier: emojiData[emojiId] + " " + emojiId });
					}
				});
			} else {
				itemsToShow.push({
					description: "Matching Emoji. Type 2 or more characters"
				});
			}
		}

		if (itemsToShow.length == 0) {
			this.hidePopup();
		} else {
			let selected = itemsToShow[0].id;

			this.setState({
				popupOpen: type,
				popupPrefix: prefix,
				popupItems: itemsToShow,
				popupIndex: 0,
				selectedPopupItem: selected
			});
		}
	}

	hidePopup() {
		this.setState({ popupOpen: false });
	}

	selectFirst() {
		this.handleSelectAtMention();
	}

	// insert the given text at the cursor of the input field
	// after first deleting the text in toDelete
	insertTextAtCursor(text, toDelete) {
		var sel, range;
		sel = window.getSelection();

		// if for some crazy reason we can't find a selection, return
		// to avoid an error.
		// https://stackoverflow.com/questions/22935320/uncaught-indexsizeerror-failed-to-execute-getrangeat-on-selection-0-is-not
		if (sel.rangeCount == 0) return;

		range = sel.getRangeAt(0);

		// delete the X characters before the caret
		range.setStart(range.commonAncestorContainer, range.startOffset - (toDelete || "").length);
		// range.moveEnd("character", toDelete.length);

		range.deleteContents();
		var textNode = document.createTextNode(text);
		range.insertNode(textNode);
		range.setStartAfter(textNode);
		sel.removeAllRanges();
		sel.addRange(range);
		this._contentEditable.htmlEl.normalize();
		// sel.collapse(textNode);
		sel.modify("move", "backward", "character");
		sel.modify("move", "forward", "character");
		// window.getSelection().empty();
		// this.focus();

		let postTextByStream = this.state.postTextByStream;
		postTextByStream[this.props.streamId] = this._contentEditable.htmlEl.innerHTML;

		this.setState({
			postTextByStream,
			cursorPosition: getCurrentCursorPosition("input-div")
		});
	}

	// the keypress handler for tracking up and down arrow
	// and enter, while the at mention popup is open
	handleAtMentionKeyPress(event, eventType) {
		event.preventDefault();
		if (eventType == "escape") {
			if (this.state.popupOpen) this.hidePopup();
			else if (this.state.emojiOpen) this.hideEmojiPicker();
			// else this.handleDismissThread();
		} else {
			let newIndex = 0;
			if (eventType == "down") {
				if (this.state.popupIndex < this.state.popupItems.length - 1) {
					newIndex = this.state.popupIndex + 1;
				} else {
					newIndex = 0;
				}
			} else if (eventType == "up") {
				if (this.state.popupIndex == 0) {
					newIndex = this.state.popupItems.length - 1;
				} else {
					newIndex = this.state.popupIndex - 1;
				}
			} else if (eventType == "tab") {
				this.selectFirst();
			}
			this.setState({
				popupIndex: newIndex,
				selectedPopupItem: this.state.popupItems[newIndex].id
			});
		}
	}

	// for keypresses that we can't capture with standard
	// javascript events
	handleNonCapturedKeyPress(event, eventType) {
		if (eventType == "up") {
			if (this.state.postTextByStream[this.props.streamId] === "") {
				this.props.onEmptyUpArrow(event);
			}
		}
		event.abortKeyBinding();
	}

	// when the user hovers over an at-mention list item, change the
	// state to represent a hovered state
	handleHoverAtMention = id => {
		let index = this.state.popupItems.findIndex(x => x.id == id);

		this.setState({
			popupIndex: index,
			selectedPopupItem: id
		});
	};

	handleSelectAtMention = id => {
		// if no id is passed, we assume that we're selecting
		// the currently-selected at mention
		if (!id) id = this.state.selectedPopupItem;

		let toInsert;
		let toInsertPostfix = "";

		if (this.state.popupOpen === "slash-commands") {
			toInsert = id + "\u00A0";
		} else if (this.state.popupOpen === "channels") {
			toInsert = id + "\u00A0";
		} else if (this.state.popupOpen === "emojis") {
			toInsert = id + ":\u00A0";
		} else {
			let user = this.props.teammates.find(t => t.id === id);
			if (!user) return;
			toInsert = user.username + "\u00A0";
		}
		this.hidePopup();
		// setTimeout(() => {
		this.focus(true);
		// }, 20);
		// the reason for this unicode space is that chrome will
		// not render a space at the end of a contenteditable div
		// unless it is a &nbsp;, which is difficult to insert
		// so we insert this unicode character instead
		this.insertTextAtCursor(toInsert, this.state.popupPrefix);
		// this.setNewPostText(text);
	};

	// depending on the contents of the input field, if the user
	// types a "@" then open the at-mention popup
	handleChange = event => {
		const newPostText = event.target.value;

		const selection = window.getSelection();
		const range = selection.getRangeAt(0);
		const node = range.commonAncestorContainer;
		const nodeText = node.textContent || "";
		const upToCursor = nodeText.substring(0, range.startOffset);
		const peopleMatch = upToCursor.match(/(?:^|\s)@([a-zA-Z0-9_.+]*)$/);
		const channelMatch = upToCursor.match(/(?:^|\s)#([a-zA-Z0-9_.+]*)$/);
		const emojiMatch = upToCursor.match(/(?:^|\s):([a-z+_]*)$/);
		const slashMatch = newPostText.match(/^\/([a-zA-Z0-9+]*)$/);
		if (this.state.popupOpen === "at-mentions") {
			if (peopleMatch) {
				this.showPopupSelectors(peopleMatch[1].replace(/@/, ""), "at-mentions");
			} else {
				// if the line doesn't end with @word, then hide the popup
				this.hidePopup();
			}
		} else if (this.state.popupOpen === "slash-commands") {
			if (slashMatch) {
				this.showPopupSelectors(slashMatch[0].replace(/\//, ""), "slash-commands");
			} else {
				// if the line doesn't start with /word, then hide the popup
				this.hidePopup();
			}
		} else if (this.state.popupOpen === "channels") {
			if (channelMatch) {
				this.showPopupSelectors(channelMatch[1].replace(/#/, ""), "channels");
			} else {
				// if the line doesn't end with #word, then hide the popup
				this.hidePopup();
			}
		} else if (this.state.popupOpen === "emojis") {
			if (emojiMatch) {
				this.showPopupSelectors(emojiMatch[1].replace(/:/, ""), "emojis");
			} else {
				// if the line doesn't look like :word, then hide the popup
				this.hidePopup();
			}
		} else {
			if (peopleMatch) this.showPopupSelectors(peopleMatch[1].replace(/@/, ""), "at-mentions");
			if (slashMatch && !this.props.multiCompose)
				this.showPopupSelectors(slashMatch[0].replace(/\//, ""), "slash-commands");
			if (channelMatch) this.showPopupSelectors(channelMatch[1].replace(/#/, ""), "channels");
			if (emojiMatch) this.showPopupSelectors(emojiMatch[1].replace(/:/, ""), "emojis");
		}
		// track newPostText as the user types
		let postTextByStream = this.state.postTextByStream;
		postTextByStream[this.props.streamId] = this._contentEditable.htmlEl.innerHTML;
		// this.setState({ postTextByStream });
		this.setState({
			postTextByStream,
			autoMentions: this.state.autoMentions.filter(mention => newPostText.includes(mention)),
			cursorPosition: getCurrentCursorPosition("input-div")
		});
	};

	// when the input field loses focus, one thing we want to do is
	// to hide the at-mention popup
	handleBlur = event => {
		event.preventDefault();
		this.hidePopup();
	};

	handleClick = event => {
		this.setState({
			cursorPosition: getCurrentCursorPosition("input-div")
		});
	};

	// https://stackoverflow.com/questions/6249095/how-to-set-caretcursor-position-in-contenteditable-element-div
	setCurrentCursorPosition = chars => {
		if (this._contentEditable.htmlEl.innerHTML === "") {
			return;
		}
		if (chars < 0) chars = 0;

		var selection = window.getSelection();

		let range = createRange(document.getElementById("input-div").parentNode, { count: chars });

		if (range) {
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	};

	handleKeyPress = event => {
		let newPostText = this.state.postTextByStream[this.props.streamId] || "";
		const { quote, popupOpen } = this.state;
		const multiCompose = quote || this.props.multiCompose;

		// if we have the at-mentions popup open, then the keys
		// do something different than if we have the focus in
		// the textarea
		if (popupOpen) {
			if (event.key == "Escape") {
				this.hidePopup();
			} else if (event.key == "Enter" && !event.shiftKey) {
				event.preventDefault();
				this.selectFirst();
			}
		} else if (event.key === "@") {
			this.showPopupSelectors("", "at-mentions");
		} else if (event.key === ":") {
			this.showPopupSelectors("", "emojis");
		} else if (!multiCompose && event.key === "/" && newPostText.length === 0) {
			this.showPopupSelectors("", "slash-commands");
		} else if (event.key === "#") {
			this.showPopupSelectors("", "channels");
		} else if (event.key === "Enter" && !event.shiftKey && !multiCompose) {
			event.preventDefault();
			this.submitThePost();
		} else if (event.key == "Escape" && multiCompose) {
			this.handleClickDismissMultiCompose();
		}
	};

	isFormInvalid = () => {
		return;
		// return isNameInvalid(this.state.name);
	};

	submitThePost = event => {
		let newPostText = this.state.postTextByStream[this.props.streamId] || "";
		const { quote, title, assignees, color, commentType, streamId } = this.state;

		if (this.props.disabled) return;

		// don't submit blank posts
		if (newPostText.trim().length === 0 && title.length === 0) return;

		// convert the text to plaintext so there is no HTML
		let text = newPostText.replace(/<br>/g, "\n");
		const doc = new DOMParser().parseFromString(text, "text/html");
		text = doc.documentElement.textContent;
		const assigneeIds = (assignees || [])
			.map(item => {
				return item.value;
			})
			.filter(Boolean);

		this.props.onSubmit({
			type: commentType,
			text,
			title,
			quote,
			mentionedUserIds: this.props.findMentionedUserIds(text, this.props.teammates),
			autoMentions: this.state.autoMentions,
			assignees: assigneeIds,
			color,
			forceStreamId: streamId
		});

		if (event.metaKey) this.softReset();
		else {
			this.reset();
			this.handleClickDismissMultiCompose();
		}
	};

	handleKeyDown = event => {
		const { quote, popupOpen } = this.state;
		const multiCompose = quote || this.props.multiCompose;

		if (this.state.popupOpen) {
			if (event.key === "ArrowUp") {
				event.stopPropagation();
				this.handleAtMentionKeyPress(event, "up");
			}
			if (event.key === "ArrowDown") this.handleAtMentionKeyPress(event, "down");
			if (event.key === "Tab") this.handleAtMentionKeyPress(event, "tab");
			if (event.key === "Escape") {
				this.hidePopup();
				event.preventDefault();
			}
		} else if (this.state.emojiOpen) {
			if (event.key === "Escape") {
				this.hideEmojiPicker();
				event.preventDefault();
			}
		} else {
			if (event.key === "ArrowUp" && this.state.postTextByStream[this.props.streamId] === "") {
				event.persist();
				event.stopPropagation();
				this.props.onEmptyUpArrow(event);
			} else if (event.key == "Escape" && multiCompose) {
				this.handleClickDismissMultiCompose();
			}
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
		this.props.setMultiCompose(this.props.commentType || "comment");
		this.setState({ quote: null });
	};

	toggleEmojiPicker = event => {
		this.setState({ emojiOpen: !this.state.emojiOpen, emojiTarget: event.target });
		// this.focus();
		// event.stopPropagation();
	};

	hideEmojiPicker = () => {
		this.setState({ emojiOpen: false });
	};

	addEmoji = emoji => {
		this.setState({ emojiOpen: false });
		if (emoji && emoji.colons) {
			this.focus();
			this.setCurrentCursorPosition(this.state.cursorPosition);
			this.insertTextAtCursor(emoji.colons); // + "\u00A0"); <= that's a space
		}
	};

	resetFields = clearOutTextToo => {
		if (clearOutTextToo) {
			let postTextByStream = this.state.postTextByStream;
			postTextByStream[this.props.streamId] = "";
			this.setState({ postTextByStream });
		}
		this.setState({
			quote: null,
			title: "",
			assignees: [],
			commentType: "comment",
			autoMentions: [],
			emojiOpen: false
		});
	};

	softReset = () => {
		this.resetFields(true);
		this.focus();
	};

	reset() {
		let postTextByStream = this.state.postTextByStream;
		postTextByStream[this.props.streamId] = "";

		this.setState({
			postTextByStream: {},
			quote: null,
			title: "",
			color: "blue",
			assignees: [],
			autoMentions: [],
			emojiOpen: false,
			multiCompose: false
		});
	}

	openMultiCompose = () => {
		this.props.setMultiCompose("comment");
		setTimeout(() => {
			this.focus();
		}, 20);
	};

	setCommentType = type => {
		this.setState({ commentType: type });
		setTimeout(() => {
			this.focus();
		}, 20);
	};

	renderCommentForm = quote => {
		const { commentType = "" } = this.state;

		const trapTip =
			"Let your teammates know about a critical section of code that should not be changed without discussion or consultation. You will be alerted when a teammate edits code within a Code Trap.";

		let range = quote ? arrayToRange(quote.location) : null;
		let rangeText = "";
		let verb = "Commenting on ";
		if (commentType === "question") verb = "Question about ";
		if (commentType === "issue") verb = "Issue in ";
		if (commentType === "trap") verb = "Code Trap for ";
		if (range) {
			if (range.start.row === range.end.row) {
				rangeText = verb + " line " + (range.start.row + 1);
			} else {
				rangeText = verb + " lines " + (range.start.row + 1) + "-" + (range.end.row + 1);
			}
		}
		if (quote && quote.file) {
			rangeText += " in " + quote.file;
		}

		const titlePlaceholder =
			commentType === "issue" || commentType === "question"
				? "Title (required)"
				: "Title (optional)";

		const teamMembersForSelect = this.props.teammates
			.map(user => {
				if (!user.isRegistered) return null;
				return {
					value: user.id,
					label: user.username
				};
			})
			.filter(Boolean);

		let commentString = commentType || "comment";
		const submitAnotherLabel = "Command-click to submit another " + commentString + " after saving";

		return [
			<div className="panel-header" key="one">
				New {commentString.charAt(0).toUpperCase() + commentString.slice(1)}
				<span className="align-right-button" onClick={this.handleClickDismissMultiCompose}>
					<Icon name="x" />
				</span>
			</div>,
			<div className="shadow-overlay" key="three">
				<div className="shadow-container">
					<div className="shadow shadow-top" />
					<div className="shadow shadow-bottom" />
				</div>
				<form id="code-comment-form" className="standard-form" key="two">
					<div className="shadow-cover-top" />
					<fieldset className="form-body">
						<div id="controls" className="control-group">
							<div className="two-column">
								<div className="half-width">
									<label>Post to</label>
									<div className="styled-select">
										<select
											onChange={e => this.setState({ streamId: e.target.value })}
											defaultValue={this.props.streamId}
										>
											{Object.values(this.props.channelStreams).map(channel => {
												return (
													<option key={channel.id} value={channel.id} id={channel.id}>
														#{channel.name}
													</option>
												);
											})}
											{Object.values(this.props.directMessageStreams).map(channel => {
												return (
													<option key={channel.id} value={channel.id} id={channel.id}>
														@{channel.name}
													</option>
												);
											})}
										</select>
									</div>
								</div>
								<div className="half-width">
									<label>Marker</label>
									<div className="styled-select">
										<select onChange={e => this.setState({ color: e.target.value })}>
											<option value="blue">Blue</option>
											<option value="green">Green</option>
											<option value="yellow">Yellow</option>
											<option value="orange">Orange</option>
											<option value="red">Red</option>
											<option value="purple">Purple</option>
											<option value="aqua">Aqua</option>
											<option value="gray">Gray</option>
											<hr />
											<option value="none">None</option>
										</select>
									</div>
								</div>
							</div>
							{quote && (
								<div style={{ position: "relative" }}>
									<span
										style={{
											position: "absolute",
											right: 0,
											top: "17px",
											cursor: "pointer",
											transform: "scale(0.75)"
										}}
										onClick={this.handleClickDismissQuote}
									>
										<Icon name="x" />
									</span>
									<Tooltip
										placement="top"
										delay=".5"
										title="Select a new range and it will update here..."
									>
										<label>{rangeText}</label>
									</Tooltip>
									{this.renderCode(quote)}
								</div>
							)}
							{!quote && <label>CodeBlock</label>}
							{!quote && (
								<div
									className="hint frame control-group"
									style={{ justifyContent: "center", marginTop: "0" }}
								>
									<Icon name="info" /> &nbsp;Select a range to comment on a block of code.
								</div>
							)}
							<div className="tab-group">
								<input
									id="radio-comment-type-comment"
									type="radio"
									name="comment-type"
									checked={commentType === "comment"}
								/>
								<label
									htmlFor="radio-comment-type-comment"
									className={createClassString({
										checked: commentType === "comment"
									})}
									onClick={e => this.setCommentType("comment")}
								>
									<Icon name="comment" className="chat-bubble" /> <b>Comment</b>
								</label>
								<input
									id="radio-comment-type-question"
									type="radio"
									name="comment-type"
									checked={commentType === "question"}
								/>
								<label
									htmlFor="radio-comment-type-question"
									className={createClassString({
										checked: commentType === "question"
									})}
									onClick={e => this.setCommentType("question")}
								>
									<Icon name="question" /> <b>Question</b>
								</label>
								<input
									id="radio-comment-type-issue"
									type="radio"
									name="comment-type"
									checked={commentType === "issue"}
								/>
								<label
									htmlFor="radio-comment-type-issue"
									className={createClassString({
										checked: commentType === "issue"
									})}
									onClick={e => this.setCommentType("issue")}
								>
									<Icon name="issue" /> <b>Issue</b>
								</label>
								<input
									id="radio-comment-type-trap"
									type="radio"
									name="comment-type"
									checked={commentType === "trap"}
								/>
								<label
									htmlFor="radio-comment-type-trap"
									className={createClassString({
										checked: commentType === "trap"
									})}
									onClick={e => this.setCommentType("trap")}
								>
									<Icon name="trap" /> <b>Code Trap</b>
								</label>
							</div>
							{commentType === "trap" && (
								<div className="hint frame control-group" style={{ marginBottom: "10px" }}>
									{trapTip}
								</div>
							)}
							{(commentType === "issue" ||
								commentType === "question" ||
								commentType === "snippet") && (
								<div className="control-group">
									<input
										type="text"
										name="title"
										className="native-key-bindings input-text control"
										value={this.state.title}
										onChange={e => this.setState({ title: e.target.value })}
										placeholder={titlePlaceholder}
										ref={ref => (this._titleInput = ref)}
									/>
								</div>
							)}
							{commentType === "issue" && (
								<div
									id="members-controls"
									className="control-group"
									style={{ marginBottom: "10px" }}
								>
									<Select
										id="input-assignees"
										name="assignees"
										classNamePrefix="native-key-bindings react-select"
										isMulti={true}
										value={this.state.assignees || []}
										options={teamMembersForSelect}
										closeMenuOnSelect={false}
										isClearable={false}
										placeholder="Assignees (optional)"
										onChange={value => this.setState({ assignees: value })}
									/>
								</div>
							)}
							{commentType === "snippet" && (
								<ContentEditable
									className={createClassString("native-key-bindings", "message-input")}
									id="snippet-div"
									tabIndex="-1"
									onChange={this.handleChange}
									onBlur={this.handleBlur}
									onClick={this.handleClick}
									html=""
									placeholder="Code goes here"
									ref={ref => (this._contentEditableSnippet = ref)}
								/>
							)}
							{this.renderMessageInput()}
						</div>
						<div className="button-group">
							<Tooltip placement="top" delay=".5" title={submitAnotherLabel}>
								<Button
									style={{
										marginLeft: "10px",
										float: "right",
										paddingLeft: "10px",
										paddingRight: "10px",
										width: "auto",
										marginRight: 0
									}}
									className="control-button"
									type="submit"
									loading={this.state.loading}
									onClick={e => this.submitThePost(e)}
								>
									Submit
								</Button>
							</Tooltip>
							<Button
								style={{ float: "right", paddingLeft: "10px", paddingRight: "10px", width: "auto" }}
								className="control-button cancel"
								type="submit"
								loading={this.state.loading}
								onClick={this.handleClickDismissMultiCompose}
							>
								Cancel
							</Button>
							<span className="hint">Styling with Markdown is supported</span>
						</div>
						<div style={{ clear: "both" }} />
						<div className="shadow-cover-bottom" />
					</fieldset>
				</form>
			</div>
		];
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
	};

	renderCode(quote) {
		const path = quote.file;
		let extension = Path.extname(path).toLowerCase();
		if (extension.startsWith(".")) {
			extension = extension.substring(1);
		}
		const codeHTML = extension
			? hljs.highlight(extension, quote.code).value
			: hljs.highlightAuto(quote.code).value;

		return <div className="code" dangerouslySetInnerHTML={{ __html: codeHTML }} />;
	}

	renderMessageInput = () => {
		let { placeholder } = this.props;
		const { quote, emojiOpen, commentType } = this.state;
		const multiCompose = quote || this.props.multiCompose;

		if (multiCompose) {
			switch (commentType) {
				case "question":
				case "issue":
				case "snippet":
					placeholder = "Description (optional)";
					break;
				case "trap":
					placeholder = "Description (required)";
					break;
			}
		}
		let contentEditableHTML = this.state.postTextByStream[this.props.streamId] || "";
		return (
			<div className="message-input-wrapper">
				<div style={{ position: "relative" }}>
					<AtMentionsPopup
						on={this.state.popupOpen}
						items={this.state.popupItems}
						prefix={this.state.popupPrefix}
						selected={this.state.selectedPopupItem}
						handleHoverAtMention={this.handleHoverAtMention}
						handleSelectAtMention={this.handleSelectAtMention}
					/>
				</div>
				{!multiCompose && (
					<div className="plus-button" onClick={this.openMultiCompose}>
						<Icon name="plus" className="plus" />
					</div>
				)}
				<Icon
					name="smiley"
					className={createClassString("smiley", {
						hover: emojiOpen
					})}
					onClick={event => this.toggleEmojiPicker(event)}
				/>
				{emojiOpen && (
					<EmojiPicker addEmoji={this.addEmoji} target={this.state.emojiTarget} autoFocus={true} />
				)}
				<ContentEditable
					className={createClassString("native-key-bindings", "message-input", btoa(placeholder), {
						"has-plus": !multiCompose
					})}
					id="input-div"
					tabIndex="-1"
					onChange={this.handleChange}
					onBlur={this.handleBlur}
					onClick={this.handleClick}
					html={contentEditableHTML}
					placeholder={placeholder}
					ref={ref => (this._contentEditable = ref)}
				/>
			</div>
		);
	};

	render() {
		const { forwardedRef } = this.props;
		const { quote } = this.state;
		const multiCompose = quote || this.props.multiCompose;

		return (
			<div
				ref={forwardedRef}
				onKeyPress={this.handleKeyPress}
				onKeyDown={this.handleKeyDown}
				className={createClassString("compose", {
					offscreen: this.props.offscreen,
					"popup-open": this.state.popupOpen,
					"multi-compose": multiCompose
				})}
			>
				<div style={{ position: "relative" }}>
					{multiCompose && this.renderCommentForm(quote)}
					{!multiCompose && this.renderMessageInput()}
				</div>
			</div>
		);
	}
}

export default React.forwardRef((props, ref) => <ComposeBox {...props} forwardedRef={ref} />);
