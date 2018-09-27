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

	focus = () => {
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

		if (type === "at-mentions") {
			Object.values(this.props.teammates).forEach(person => {
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
			if (this.state.emojiOpen) this.hideEmojiPicker();
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
		setTimeout(() => {
			this.focus();
		}, 20);
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
			if (slashMatch) this.showPopupSelectors(slashMatch[0].replace(/\//, ""), "slash-commands");
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

		// if we have the at-mentions popup open, then the keys
		// do something different than if we have the focus in
		// the textarea
		if (this.state.popupOpen) {
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
		} else if (event.key === "/" && newPostText.length === 0) {
			this.showPopupSelectors("", "slash-commands");
		} else if (event.key === "#") {
			this.showPopupSelectors("", "channels");
		} else if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			if (newPostText.trim().length > 0 && !this.props.disabled) {
				// convert the text to plaintext so there is no HTML
				let text = newPostText.replace(/<br>/g, "\n");
				const doc = new DOMParser().parseFromString(text, "text/html");
				text = doc.documentElement.textContent;

				let title = this.state.title;

				this.props.onSubmit({
					text,
					title,
					quote: this.state.quote,
					mentionedUserIds: this.props.findMentionedUserIds(text, this.props.teammates),
					autoMentions: this.state.autoMentions
				});
				this.reset();
			} else {
				// don't submit blank posts
			}
		}
	};

	handleKeyDown = event => {
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
			}
		}
	};

	handleClickDismissQuote = event => {
		event.preventDefault();
		this.focus();
		this.reset();
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

	reset() {
		this.setState({
			postTextByStream: [],
			quote: null,
			autoMentions: [],
			emojiOpen: false,
			multiCompose: false
		});
	}

	openMultiCompose = () => {
		this.setState({ multiCompose: true });
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
		const { commentType } = this.state;

		const multiCompose = quote || this.state.multiCompose;

		const trapTip =
			"Let your teammates know about a critical section of code that should not be changed without discussion or consultation. You will be alerted when a teammate edits code within a Code Trap.";

		let range = quote ? arrayToRange(quote.location) : null;
		let rangeText = "";
		if (range) {
			if (range.start.row === range.end.row) {
				rangeText = "Commenting on line " + (range.start.row + 1);
			} else {
				rangeText = "Commenting on lines " + (range.start.row + 1) + "-" + (range.end.row + 1);
			}
		}
		if (quote && quote.file) {
			rangeText += " in " + quote.file;
		}

		const titlePlaceholder =
			commentType === "issue" || commentType === "question"
				? "Title (required)"
				: "Title (optional)";

		// <span>{rangeText}</span>
		return (
			<form id="code-comment-form" className="standard-form vscroll">
				<div className="panel-header">
					<span className="align-right-button" onClick={this.handleClickDismissQuote}>
						<Icon name="x" />
					</span>
				</div>
				<fieldset className="form-body">
					<div id="controls" className="control-group">
						{quote && (
							<div>
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
						{!quote && (
							<div style={{ padding: "20px", textAlign: "center", fontStyle: "italic" }}>
								Select a range to comment on a specific block of code.
							</div>
						)}
						<label>Post to</label>
						<div className="styled-select">
							<select>
								{Object.values(this.props.channelStreams).map(channel => {
									if (channel.name.match(/^ls:/)) return null;
									const selected = channel.id === this.props.streamId ? "selected" : "";
									return (
										<option selected={selected} id={channel.id}>
											#{channel.name}
										</option>
									);
								})}
							</select>
						</div>
						<div className="tab-group">
							<input
								id="radio-comment-type-comment"
								type="radio"
								name="comment-type"
								checked={commentType === "comment"}
								onChange={e => this.setCommentType("comment")}
							/>
							<label
								htmlFor="radio-comment-type-comment"
								className={createClassString({
									checked: commentType === "comment"
								})}
							>
								<Icon name="comment" className="chat-bubble" /> <span>Comment</span>
							</label>
							<input
								id="radio-comment-type-question"
								type="radio"
								name="comment-type"
								checked={commentType === "question"}
								onChange={e => this.setCommentType("question")}
							/>
							<label
								htmlFor="radio-comment-type-question"
								className={createClassString({
									checked: commentType === "question"
								})}
							>
								<Icon name="question" /> <span>Question</span>
							</label>
							<input
								id="radio-comment-type-issue"
								type="radio"
								name="comment-type"
								checked={commentType === "issue"}
								onChange={e => this.setCommentType("issue")}
							/>
							<label
								htmlFor="radio-comment-type-issue"
								className={createClassString({
									checked: commentType === "issue"
								})}
							>
								<Icon name="bug" /> <span>Issue</span>
							</label>
							<input
								id="radio-comment-type-trap"
								type="radio"
								name="comment-type"
								checked={commentType === "trap"}
								onChange={e => this.setCommentType("trap")}
							/>
							<label
								htmlFor="radio-comment-type-trap"
								className={createClassString({
									checked: commentType === "trap"
								})}
							>
								<Icon name="stop" /> <span>Code Trap</span>
							</label>
							<input
								id="radio-comment-type-snippet"
								type="radio"
								name="comment-type"
								checked={commentType === "snippet"}
								onChange={e => this.setCommentType("snippet")}
							/>
							<label
								htmlFor="radio-comment-type-snippet"
								className={createClassString({
									checked: commentType === "snippet"
								})}
							>
								<Icon name="code" /> <span>Snippet</span>
							</label>
						</div>
						{commentType === "trap" && <div className="hint frame">{trapTip}</div>}
					</div>
					{(commentType === "issue" || commentType === "question" || commentType === "snippet") && (
						<input
							type="text"
							name="title"
							className="native-key-bindings input-text control"
							onChange={value => this.setState({ title: value })}
							placeholder={titlePlaceholder}
							ref={ref => (this._titleInput = ref)}
						/>
					)}
					{commentType === "issue" && (
						<div id="members-controls" className="control-group">
							<Select
								id="input-assignees"
								name="assignees"
								classNamePrefix="native-key-bindings react-select"
								isMulti={true}
								value={this.state.assignees || []}
								options={this.props.teammates}
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
				</fieldset>
			</form>
		);
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

	render() {
		let { placeholder } = this.props;
		const { forwardedRef } = this.props;
		const { quote, emojiOpen, commentType } = this.state;
		const multiCompose = quote || this.state.multiCompose;

		let contentEditableHTML = this.state.postTextByStream[this.props.streamId] || "";

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

		return (
			<div
				ref={forwardedRef}
				onKeyPress={this.handleKeyPress}
				onKeyDown={this.handleKeyDown}
				className={createClassString("compose", {
					offscreen: this.props.offscreen,
					"popup-open": this.state.popupOpen,
					"full-height": multiCompose
				})}
			>
				<AtMentionsPopup
					on={this.state.popupOpen}
					items={this.state.popupItems}
					prefix={this.state.popupPrefix}
					selected={this.state.selectedPopupItem}
					handleHoverAtMention={this.handleHoverAtMention}
					handleSelectAtMention={this.handleSelectAtMention}
				/>
				<div className="multi-compose">
					{multiCompose && this.renderCommentForm(quote)}
					<div className="message-input-wrapper">
						{!multiCompose && <Icon name="plus" className="plus" onClick={this.openMultiCompose} />}
						{!multiCompose && <div className="plus-sep" />}
						<Icon
							name="smiley"
							className={createClassString("smiley", {
								hover: emojiOpen
							})}
							onClick={event => this.toggleEmojiPicker(event)}
						/>
						{emojiOpen && (
							<EmojiPicker
								addEmoji={this.addEmoji}
								target={this.state.emojiTarget}
								autoFocus={true}
							/>
						)}
						<ContentEditable
							className={createClassString(
								"native-key-bindings",
								"message-input",
								btoa(placeholder),
								{ "has-plus": !multiCompose }
							)}
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
					{multiCompose && (
						<div className="button-group">
							<Button
								style={{
									marginLeft: "10px",
									float: "right",
									paddingLeft: "10px",
									paddingRight: "10px"
								}}
								className="control-button"
								type="submit"
								loading={this.state.loading}
								onClick={this.handleClickCreateChannel}
							>
								Submit
							</Button>
							<Button
								style={{ float: "right", paddingLeft: "10px", paddingRight: "10px" }}
								className="control-button cancel"
								type="submit"
								loading={this.state.loading}
								onClick={this.handleClickDismissQuote}
							>
								Cancel
							</Button>
							<span className="hint">Styling with Markdown is supported</span>
						</div>
					)}
				</div>
			</div>
		);
	}
}

export default React.forwardRef((props, ref) => <ComposeBox {...props} forwardedRef={ref} />);
