import cx from "classnames";
import * as React from "react";
import ContentEditable from "react-contenteditable";
const emojiData = require("../node_modules/markdown-it-emoji-mart/lib/data/full.json");
import { CSChannelStream, CSPost, CSUser } from "../shared/api.protocol";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import {
	createRange,
	debounceToAnimationFrame,
	getCurrentCursorPosition,
	isInVscode
} from "../utils";
import AtMentionsPopup from "./AtMentionsPopup";
import EmojiPicker from "./EmojiPicker";
import Icon from "./Icon";

type PopupType = "at-mentions" | "slash-commands" | "channels" | "emojis";

type QuotePost = CSPost & { author: { username: string } };

interface State {
	emojiOpen: boolean;
	cursorPosition?: any;
	currentPopup?: PopupType;
	popupPrefix?: string;
	popupItems?: any[];
	popupIndex?: number;
	selectedPopupItem?: string;
	emojiMenuTarget?: any;
}

interface Props {
	text: string;
	teammates: CSUser[];
	currentUserId: string;
	slashCommands: any[];
	services: any[];
	channelStreams: CSChannelStream[];
	isSlackTeam: boolean;
	isDirectMessage: boolean;
	multiCompose: boolean;
	submitOnEnter: boolean;
	placeholder?: string;
	quotePost?: QuotePost;
	onChange(text: string): any;
	onEmptyUpArrow(event: React.KeyboardEvent): any;
	onDismiss(): any;
	onSubmit?(): any;
	tabIndex?: number;
	__onDidRender?(stuff: { [key: string]: any }): any; // HACKy: sneaking internals to parent
}

export class MessageInput extends React.Component<Props, State> {
	_contentEditable?: { htmlEl: HTMLElement };
	disposables: { dispose(): any }[] = [];

	constructor(props: Props) {
		super(props);
		this.state = { emojiOpen: false };
	}

	componentDidMount() {
		if (this.props.quotePost) {
			this.quotePost();
		}
		// so that HTML doesn't get pasted into the input field. without this,
		// HTML would be rendered as HTML when pasted
		if (this._contentEditable) {
			this._contentEditable.htmlEl.addEventListener("paste", function(e) {
				e.preventDefault();
				const text = e.clipboardData.getData("text/plain");
				document.execCommand("insertHTML", false, text.replace(/\n/g, "<br>"));
			});
		}

		if (isInVscode()) {
			this.disposables.push(
				VsCodeKeystrokeDispatcher.on("keydown", event => {
					if (event.key === "Escape" && event.target.id !== "input-div") {
						this.handleKeyDown(event);
					}
				})
			);
		}
		// TODO: move this into MessageInput
		// because atom hijacks most keystroke events
		// if (global.atom) {
		// 	this.disposables.push(
		// 		atom.commands.add("atom-workspace", {
		// 			"codestream:focus-input": _event => this.focus()
		// 		}),
		// 		atom.commands.add(".codestream", "codestream:escape", {
		// 			didDispatch: event => this.handleAtMentionKeyPress(event, "escape"),
		// 			hiddenInCommandPalette: true
		// 		}),
		// 		atom.commands.add(".codestream .compose.popup-open", "codestream:popup-move-up", {
		// 			didDispatch: event => this.handleAtMentionKeyPress(event, "up"),
		// 			hiddenInCommandPalette: true
		// 		}),
		// 		atom.commands.add(".codestream .compose.popup-open", "codestream:popup-move-down", {
		// 			didDispatch: event => this.handleAtMentionKeyPress(event, "down"),
		// 			hiddenInCommandPalette: true
		// 		}),
		// 		atom.commands.add(".codestream .compose.popup-open", "codestream:popup-tab", {
		// 			didDispatch: event => this.handleAtMentionKeyPress(event, "tab"),
		// 			hiddenInCommandPalette: true
		// 		}),
		// 		atom.commands.add(".codestream .native-key-bindings", "codestream:move-up", {
		// 			didDispatch: event => this.handleNonCapturedKeyPress(event, "up"),
		// 			hiddenInCommandPalette: true
		// 		})
		// 	);
		// }
	}

	componentDidUpdate(prevProps: Props) {
		if (
			(this.props.quotePost && !prevProps.quotePost) ||
			(this.props.quotePost &&
				prevProps.quotePost &&
				this.props.quotePost.id !== prevProps.quotePost.id)
		) {
			this.quotePost();
		}
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	quotePost() {
		if (this._contentEditable) {
			this._contentEditable.htmlEl.innerHTML = "";
			this.props.onChange("");
		}
		this.focus(() => {
			const post = this.props.quotePost!;
			this.insertTextAtCursor("@" + post.author.username + " said:");
			this.insertNewlineAtCursor();
			this.insertTextAtCursor(">" + post.text);
			this.insertNewlineAtCursor();
		});
	}

	// for keypresses that we can't capture with standard
	// javascript events
	// handleNonCapturedKeyPress(event, eventType) {
	// 	if (eventType == "up") {
	// 		if (this.state.postTextByStream[this.props.streamId] === "") {
	// 			this.props.onEmptyUpArrow(event);
	// 		}
	// 	}
	// 	event.abortKeyBinding();
	// }

	hidePopup() {
		this.setState({ currentPopup: undefined });
	}

	hideEmojiPicker = () => {
		this.setState({ emojiOpen: false });
	}

	addEmoji = (emoji: typeof emojiData[string]) => {
		this.setState({ emojiOpen: false });
		if (emoji && emoji.colons) {
			this.focus(() => {
				this.setCurrentCursorPosition(this.state.cursorPosition);
				this.insertTextAtCursor(emoji.colons); // + "\u00A0"); <= that's a space
			});
		}
	}

	// https://stackoverflow.com/questions/6249095/how-to-set-caretcursor-position-in-contenteditable-element-div
	setCurrentCursorPosition = chars => {
		if (!this._contentEditable) return;

		if (this._contentEditable.htmlEl.innerHTML === "") {
			return;
		}
		if (chars < 0) chars = 0;

		const selection = window.getSelection();

		const inputDiv = document.getElementById("input-div");
		if (inputDiv) {
			const range = createRange(inputDiv.parentNode, { count: chars });

			if (range) {
				range.collapse(false);
				selection.removeAllRanges();
				selection.addRange(range);
			}
		}
	}

	// set up the parameters to pass to the at mention popup
	showPopupSelectors(prefix: string, type: PopupType) {
		const itemsToShow: {
			id?: string;
			headshot?: CSUser;
			identifier?: string;
			description?: string;
		}[] = [];

		// filter out yourself

		if (type === "at-mentions") {
			const teammates = this.props.teammates.filter(({ id }) => id !== this.props.currentUserId);
			Object.values(teammates).forEach(person => {
				const toMatch = person.fullName + "*" + person.username;
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
			// TODO: filtering these commands should happen higher up in the tree
			this.props.slashCommands.map(command => {
				if (command.channelOnly && this.props.isDirectMessage) return;
				if (command.requires && !this.props.services[command.requires]) return;
				if (command.codeStreamTeam && this.props.isSlackTeam) return;
				if (command.slackTeam && !this.props.isSlackTeam) return;
				const lowered = command.id.toLowerCase();
				if (lowered.indexOf(prefix) === 0) {
					command.identifier = command.id;
					itemsToShow.push(command);
				}
			});
		} else if (type === "channels") {
			Object.values(this.props.channelStreams).forEach(channel => {
				const toMatch = channel.name;
				if (toMatch.toLowerCase().indexOf(prefix) !== -1) {
					itemsToShow.push({
						id: channel.name,
						identifier: "#" + channel.name,
						description: channel.purpose || ""
					});
				}
			});
		} else if (type === "emojis") {
			if (prefix && prefix.length > 1) {
				debugger;
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
			const selected = itemsToShow[0].id;

			this.setState({
				currentPopup: type,
				popupPrefix: prefix,
				popupItems: itemsToShow,
				popupIndex: 0,
				selectedPopupItem: selected
			});
		}
	}

	// when the input field loses focus, one thing we want to do is
	// to hide the at-mention popup
	handleBlur = (event: React.SyntheticEvent) => {
		event.preventDefault();
		this.hidePopup();
	}

	handleClick = event => {
		this.setState({
			cursorPosition: getCurrentCursorPosition("input-div")
		});
	}

	// depending on the contents of the input field, if the user
	// types a "@" then open the at-mention popup
	handleChange = (event: React.SyntheticEvent) => {
		const newPostText = (event.target as any).value;

		const selection = window.getSelection();
		const range = selection.getRangeAt(0);
		const node = range.commonAncestorContainer;
		const nodeText = node.textContent || "";
		const upToCursor = nodeText.substring(0, range.startOffset);
		const peopleMatch = upToCursor.match(/(?:^|\s)@([a-zA-Z0-9_.+]*)$/);
		const channelMatch = upToCursor.match(/(?:^|\s)#([a-zA-Z0-9_.+]*)$/);
		const emojiMatch = upToCursor.match(/(?:^|\s):([a-z+_]*)$/);
		const slashMatch = newPostText.match(/^\/([a-zA-Z0-9+]*)$/);
		if (this.state.currentPopup === "at-mentions") {
			if (peopleMatch) {
				this.showPopupSelectors(peopleMatch[1].replace(/@/, ""), "at-mentions");
			} else {
				// if the line doesn't end with @word, then hide the popup
				this.hidePopup();
			}
		} else if (this.state.currentPopup === "slash-commands") {
			if (slashMatch) {
				this.showPopupSelectors(slashMatch[0].replace(/\//, ""), "slash-commands");
			} else {
				// if the line doesn't start with /word, then hide the popup
				this.hidePopup();
			}
		} else if (this.state.currentPopup === "channels") {
			if (channelMatch) {
				this.showPopupSelectors(channelMatch[1].replace(/#/, ""), "channels");
			} else {
				// if the line doesn't end with #word, then hide the popup
				this.hidePopup();
			}
		} else if (this.state.currentPopup === "emojis") {
			if (emojiMatch) {
				this.showPopupSelectors(emojiMatch[1].replace(/:/, ""), "emojis");
			} else {
				// if the line doesn't look like :word, then hide the popup
				this.hidePopup();
			}
		} else {
			if (peopleMatch) this.showPopupSelectors(peopleMatch[1].replace(/@/, ""), "at-mentions");
			if (slashMatch && !this.props.multiCompose) {
				this.showPopupSelectors(slashMatch[0].replace(/\//, ""), "slash-commands");
			}
			if (channelMatch) this.showPopupSelectors(channelMatch[1].replace(/#/, ""), "channels");
			if (emojiMatch) this.showPopupSelectors(emojiMatch[1].replace(/:/, ""), "emojis");
		}

		// track newPostText as the user types
		this.props.onChange(this._contentEditable!.htmlEl.innerHTML);
		this.setState({
			// autoMentions: this.state.autoMentions.filter(mention => newPostText.includes(mention)), // TODO
			cursorPosition: getCurrentCursorPosition("input-div")
		});
	}

	handleSelectAtMention = (id?: string) => {
		// if no id is passed, we assume that we're selecting
		// the currently-selected at mention
		if (!id) id = this.state.selectedPopupItem;

		let toInsert;
		const toInsertPostfix = "";

		if (this.state.currentPopup === "slash-commands") {
			toInsert = id + "\u00A0";
		} else if (this.state.currentPopup === "channels") {
			toInsert = id + "\u00A0";
		} else if (this.state.currentPopup === "emojis") {
			toInsert = id + ":\u00A0";
		} else {
			const user = this.props.teammates.find(t => t.id === id);
			if (!user) return;
			toInsert = user.username + "\u00A0";
		}
		this.hidePopup();
		// setTimeout(() => {
		this.focus();
		// }, 20);
		// the reason for this unicode space is that chrome will
		// not render a space at the end of a contenteditable div
		// unless it is a &nbsp;, which is difficult to insert
		// so we insert this unicode character instead
		this.insertTextAtCursor(toInsert, this.state.popupPrefix);
	}

	// insert the given text at the cursor of the input field
	// after first deleting the text in toDelete
	insertTextAtCursor = (text: string, toDelete: string = "") => {
		let sel, range;
		sel = window.getSelection();

		// if for some crazy reason we can't find a selection, return
		// to avoid an error.
		// https://stackoverflow.com/questions/22935320/uncaught-indexsizeerror-failed-to-execute-getrangeat-on-selection-0-is-not
		if (sel.rangeCount == 0) return;

		range = sel.getRangeAt(0);

		// delete the X characters before the caret
		range.setStart(range.commonAncestorContainer, range.startOffset - toDelete.length);
		// range.moveEnd("character", toDelete.length);

		range.deleteContents();
		const textNode = document.createTextNode(text);
		range.insertNode(textNode);
		range.setStartAfter(textNode);
		sel.removeAllRanges();
		sel.addRange(range);
		if (this._contentEditable) {
			this._contentEditable.htmlEl.normalize();
			// sel.collapse(textNode);
			sel.modify("move", "backward", "character");
			sel.modify("move", "forward", "character");
			// window.getSelection().empty();
			// this.focus();

			this.props.onChange(this._contentEditable!.htmlEl.innerHTML);
			this.setState({
				cursorPosition: getCurrentCursorPosition("input-div")
			});
		}
	}

	insertNewlineAtCursor() {
		let sel, range;
		sel = window.getSelection();

		// if for some crazy reason we can't find a selection, return
		// to avoid an error.
		// https://stackoverflow.com/questions/22935320/uncaught-indexsizeerror-failed-to-execute-getrangeat-on-selection-0-is-not
		if (sel.rangeCount == 0) return;

		range = sel.getRangeAt(0);

		// delete the X characters before the caret
		range.setStart(range.commonAncestorContainer, range.startOffset);
		// range.moveEnd("character", toDelete.length);

		range.deleteContents();
		const br1 = document.createElement("BR");
		const br2 = document.createElement("BR");
		range.insertNode(br1);
		range.insertNode(br2);
		range.setStartAfter(br2);
		sel.removeAllRanges();
		sel.addRange(range);
		if (this._contentEditable) {
			this._contentEditable.htmlEl.normalize();
			// sel.collapse(textNode);
			sel.modify("move", "backward", "character");
			sel.modify("move", "forward", "character");
			// window.getSelection().empty();
			// this.focus();

			this.props.onChange(this._contentEditable.htmlEl.innerHTML);
			this.setState({
				cursorPosition: getCurrentCursorPosition("input-div")
			});
		}
	}

	// this is asynchronous so callers should provide a callback for code that depends on the completion of this
	focus = debounceToAnimationFrame((cb?: Function) => {
		if (this._contentEditable) this._contentEditable.htmlEl.focus();
		cb && cb.apply(undefined);
	});

	handleKeyPress = (event: React.KeyboardEvent) => {
		const newPostText = this.props.text;
		const { currentPopup } = this.state;
		const multiCompose = this.props.multiCompose;

		// if we have the at-mentions popup open, then the keys
		// do something different than if we have the focus in
		// the textarea
		if (currentPopup) {
			if (event.key == "Escape") {
				this.hidePopup();
			} else if (event.key == "Enter" && !event.shiftKey) {
				event.preventDefault();
				this.handleSelectAtMention();
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
			const { onSubmit } = this.props;
			onSubmit && onSubmit();
		} else if (event.key == "Escape" && multiCompose) {
			this.props.onDismiss();
		}
	}

	// the keypress handler for tracking up and down arrow
	// and enter, while the at mention popup is open
	handleAtMentionKeyPress(event: React.KeyboardEvent, eventType: string) {
		event.preventDefault();
		if (eventType == "escape") {
			if (this.state.currentPopup) this.hidePopup();
			else if (this.state.emojiOpen) this.hideEmojiPicker();
			// else this.handleDismissThread();
		} else {
			let newIndex = 0;
			if (eventType == "down") {
				if (this.state.popupIndex! < this.state.popupItems!.length - 1) {
					newIndex = this.state.popupIndex! + 1;
				} else {
					newIndex = 0;
				}
			} else if (eventType == "up") {
				if (this.state.popupIndex == 0) {
					newIndex = this.state.popupItems!.length - 1;
				} else {
					newIndex = this.state.popupIndex! - 1;
				}
			} else if (eventType == "tab") {
				this.handleSelectAtMention();
			}
			this.setState({
				popupIndex: newIndex,
				selectedPopupItem: this.state.popupItems![newIndex].id
			});
		}
	}

	handleKeyDown = (event: React.KeyboardEvent) => {
		const multiCompose = this.props.multiCompose;

		if (this.state.currentPopup) {
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
			if (event.key === "ArrowUp" && this.props.text === "") {
				event.persist();
				event.stopPropagation();
				this.props.onEmptyUpArrow(event);
			} else if (event.key == "Escape" && multiCompose) {
				this.props.onDismiss();
			}
		}
	}

	handleHoverAtMention = id => {
		const index = this.state.popupItems!.findIndex(x => x.id == id);

		this.setState({
			popupIndex: index,
			selectedPopupItem: id
		});
	}

	handleClickEmojiButton = (event: React.SyntheticEvent) => {
		event.persist();
		this.setState(state => ({ emojiOpen: !state.emojiOpen, emojiMenuTarget: event.target }));
		// this.focus();
		// event.stopPropagation();
	}

	render() {
		const { placeholder, text, __onDidRender } = this.props;

		__onDidRender &&
			__onDidRender({ insertTextAtCursor: this.insertTextAtCursor, focus: this.focus });

		return (
			<div
				className="message-input-wrapper"
				onKeyPress={this.handleKeyPress}
				onKeyDown={this.handleKeyDown}
			>
				<div style={{ position: "relative" }}>
					<AtMentionsPopup
						on={Boolean(this.state.currentPopup)}
						items={this.state.popupItems}
						prefix={this.state.popupPrefix}
						selected={this.state.selectedPopupItem}
						handleHoverAtMention={this.handleHoverAtMention}
						handleSelectAtMention={this.handleSelectAtMention}
					/>
				</div>
				<React.Fragment>
					<Icon
						name="smiley"
						className={cx("smiley", {
							hover: this.state.emojiOpen
						})}
						onClick={this.handleClickEmojiButton}
					/>
					{this.state.emojiOpen && (
						<EmojiPicker
							addEmoji={this.addEmoji}
							target={this.state.emojiMenuTarget}
							autoFocus={true}
						/>
					)}
				</React.Fragment>
				<ContentEditable
					className={cx("native-key-bindings", "message-input", btoa(placeholder || ""), {
						"has-plus": !this.props.multiCompose
					})}
					id="input-div"
					tabIndex={this.props.tabIndex}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
					onClick={this.handleClick}
					html={text}
					placeholder={placeholder}
					ref={ref => (this._contentEditable = ref)}
				/>
			</div>
		);
	}
}
