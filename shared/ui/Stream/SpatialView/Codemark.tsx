import React from "react";
import cx from "classnames";
import { CodemarkPlus, DocumentMarker } from "@codestream/protocols/agent";
import Headshot from "../Headshot";
import { useSelector, useDispatch } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";
import { getUserByCsId, getUsernames } from "@codestream/webview/store/users/reducer";
import { markdownify } from "../Markdowner";
import Timestamp from "../Timestamp";
import Icon from "../Icon";
import Menu from "../Menu";
import { range, emptyObject, noop } from "@codestream/webview/utils";
import Tooltip from "../Tooltip";
import { CodemarkType, CodemarkStatus } from "@codestream/protocols/api";
import { setCodemarkStatus, createPost } from "../actions";

const renderTextLinkified = (
	text: string,
	currentUserName: string,
	usernames: string[],
	query?: string
) => {
	let html: string;
	if (text == null || text === "") {
		html = "";
	} else {
		html = markdownify(text).replace(/@(\w+)/g, (match: string, name: string) => {
			if (usernames.some(n => name.localeCompare(n, undefined, { sensitivity: "accent" }) === 0)) {
				return `<span class="at-mention${
					currentUserName.localeCompare(name, undefined, { sensitivity: "accent" }) === 0
						? " me"
						: ""
				}">${match}</span>`;
			}

			return match;
		});

		if (query != undefined) {
			const matchQueryRegexp = new RegExp(query, "gi");
			html = html.replace(matchQueryRegexp, "<u><b>$&</b></u>");
		}
	}

	return html;
};

interface Props {
	selected?: boolean;
	collapsed?: boolean;
	inline?: boolean;
	hover?: boolean;
	codemark: CodemarkPlus;
	marker: DocumentMarker;
	postAction?(...args: any[]): any;
	// action(action: string, post: any, args: any): any;
	onClick?(event: React.SyntheticEvent, codemark: CodemarkPlus, marker: DocumentMarker): any;
	onMouseEnter?(marker: DocumentMarker): any;
	onMouseLeave?(marker: DocumentMarker): any;
	query?: string;
	lineNum?: Number;
	showLabelText?: boolean;
	// hidden: boolean;
	deselectCodemarks?: Function;
	// teammates?: CSUser[];
}

Codemark.defaultProps = {
	onMouseEnter: noop,
	onMouseLeave: noop
};

export function Codemark(props: Props) {
	const { author, currentUser, usernames, codemarkKeybindings } = useSelector(
		(state: CodeStreamState) => ({
			author: getUserByCsId(state.users, props.codemark.creatorId)!,
			currentUser: state.users[state.session.userId!],
			usernames: getUsernames(state),
			codemarkKeybindings: state.preferences.codemarkKeybindings || emptyObject
		})
	);

	const dispatch = useDispatch();

	const handleHover = React.useCallback(
		(_event: React.MouseEvent) => props.onMouseEnter!(props.marker),
		[props.onMouseEnter]
	);
	const handleHoverEnd = React.useCallback(
		(_event: React.MouseEvent) => props.onMouseLeave!(props.marker),
		[props.onMouseLeave]
	);

	const [menuState, setMenuState] = React.useState<{ open: boolean; target?: Element }>({
		open: false,
		target: undefined
	});

	const handleMenuIconClick = React.useCallback((event: React.MouseEvent) => {
		event.stopPropagation();
		const target = event.target as Element;
		setMenuState(state => ({ open: !state.open, target: target }));
	}, []);

	const handleMenuSelection = React.useCallback(() => {
		setMenuState({ open: false });
	}, []);

	const menuItems = React.useMemo(() => {
		let items: any[] = [
			// { label: "Add Reaction", action: "react" },
			// { label: "Get Permalink", action: "get-permalink" },
			// { label: "-" }
		];

		if (props.codemark.pinned) {
			items.push({ label: "Archive", action: "toggle-pinned" });
		} else {
			items.push({ label: "Unarchive", action: "toggle-pinned" });
		}

		if (currentUser.id === author.id) {
			items.push(
				{ label: "Edit", action: "edit-post" },
				{ label: "Delete", action: "delete-post" }
			);
		}

		const submenu = range(1, 10).map(index => {
			const inUse = codemarkKeybindings[index] ? " (in use)" : "";
			return {
				label: `${index}${inUse}`,
				action: `set-keybinding-${index}`
			};
		});

		items.push({ label: "Set Keybinding", action: "set-keybinding", submenu: submenu });
		return items;
	}, [props.codemark, codemarkKeybindings]);

	let defaultViewText = props.codemark.title || props.codemark.text;
	let lineBreakIndex = defaultViewText.indexOf("\n");
	if (lineBreakIndex > -1 && lineBreakIndex < 75) {
		defaultViewText = defaultViewText.substring(0, defaultViewText.indexOf("\n"));
	} else if (defaultViewText.length > 75) {
		defaultViewText = defaultViewText.substring(0, 75);
	}

	const handleClickStatusToggle = React.useCallback(
		async (event: React.MouseEvent) => {
			event.preventDefault();
			if (props.codemark.status === CodemarkStatus.Closed) {
				await dispatch(setCodemarkStatus(props.codemark.id, CodemarkStatus.Open));
				await dispatch(
					createPost(props.codemark.streamId, props.codemark.postId, "/me opened this issue")
				);
			} else {
				await dispatch(setCodemarkStatus(props.codemark.id, CodemarkStatus.Closed));
				await dispatch(
					createPost(props.codemark.streamId, props.codemark.postId, "/me closed this issue")
				);
			}
		},
		[props.codemark]
	);

	return (
		<div className="card codemark-v2" onMouseEnter={handleHover} onMouseLeave={handleHoverEnd}>
			<div className="header">
				<span className="author">
					<Headshot person={author} />
					{author.username}
				</span>
				<Timestamp time={props.codemark.createdAt} />
				<div className="float-right">
					<div className="menu-icon" onClick={handleMenuIconClick}>
						<Icon name="kebab-vertical" clickable />
						{menuState.open && (
							<Menu items={menuItems} target={menuState.target} action={handleMenuSelection} />
						)}
					</div>
					{props.codemark.type === CodemarkType.Issue && (
						<Tooltip title="Mark as resolved and hide discussion" placement="topRight">
							<div className="resolve-button" onClick={handleClickStatusToggle}>
								{props.codemark.status === CodemarkStatus.Open ? "Resolve" : "Reopen"}
							</div>
						</Tooltip>
					)}
				</div>
			</div>
			<div className="body">
				<div
					className="title"
					dangerouslySetInnerHTML={{
						__html: renderTextLinkified(
							defaultViewText,
							currentUser.username,
							usernames /* TODO: query */
						)
					}}
				/>
			</div>
		</div>
	);
}
