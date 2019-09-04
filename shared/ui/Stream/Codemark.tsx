import cx from "classnames";
import React from "react";
import { connect } from "react-redux";
import { Range } from "vscode-languageserver-protocol";
import { fetchThread, setCodemarkStatus, setUserPreference } from "./actions";
import Headshot from "./Headshot";
import Tag from "./Tag";
import Icon from "./Icon";
import Menu from "./Menu";
import { InjectAsComment } from "./InjectAsComment";
import { markdownify } from "./Markdowner";
import Timestamp from "./Timestamp";
import CodemarkDetails from "./CodemarkDetails";
import {
	DocumentMarker,
	CodemarkPlus,
	OpenUrlRequestType,
	Capabilities,
	GetDocumentFromMarkerRequestType
} from "@codestream/protocols/agent";
import { CodemarkType, CSUser, CSMe, CSPost } from "@codestream/protocols/api";
import { HostApi } from "../webview-api";
import { SetCodemarkPinnedRequestType } from "@codestream/protocols/agent";
import { range, areRangesEqual } from "../utils";
import {
	getUserByCsId,
	getTeamMembers,
	getUsernames,
	getTeamTagsHash
} from "../store/users/reducer";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";
import { CodemarkForm } from "./CodemarkForm";
import { deleteCodemark, editCodemark } from "../store/codemarks/actions";
import { confirmPopup } from "./Confirm";
import { getPost } from "../store/posts/reducer";
import { getPosts } from "../store/posts/actions";
import Tooltip from "./Tooltip";
import { getCurrentTeamProvider } from "../store/teams/actions";
import { isNil } from "lodash-es";
import { CodeStreamState } from "../store";
import { EditorHighlightRangeRequestType } from "@codestream/protocols/webview";
import { setCurrentCodemark } from "../store/context/actions";
import { RelatedCodemark } from "./RelatedCodemark";

interface State {
	hover: boolean;
	isEditing: boolean;
	isInjecting: boolean;
	menuOpen?: boolean;
	menuTarget?: any;
}

interface DispatchProps {
	deleteCodemark: typeof deleteCodemark;
	editCodemark: typeof editCodemark;
	fetchThread: typeof fetchThread;
	setCodemarkStatus: typeof setCodemarkStatus;
	setUserPreference: typeof setUserPreference;
	getPosts: typeof getPosts;
	setCurrentCodemark: typeof setCurrentCodemark;
}

interface ConnectedProps {
	teammates: CSUser[];
	usernames: string[];
	author: CSUser;
	capabilities: Capabilities;
	codemarkKeybindings: { [key: string]: string };
	currentUser: CSMe;
	editorHasFocus: boolean;
	pinnedReplies: CSPost[];
	pinnedAuthors: CSUser[];
	relatedCodemarkIds: string[];
	isCodeStreamTeam: boolean;
	teamTagsHash: any;
}

export type DisplayType = "default" | "collapsed";

interface InheritedProps {
	contextName?: "Spatial View" | "Codemarks Tab";
	displayType?: DisplayType;
	selected?: boolean;
	codemark: CodemarkPlus;
	marker: DocumentMarker;
	postAction?(...args: any[]): any;
	action(action: string, post: any, args: any): any;
	onClick?(event: React.SyntheticEvent, codemark: CodemarkPlus, marker: DocumentMarker): any;
	highlightCodeInTextEditor?: boolean;
	query?: string;
	hidden?: boolean;
	deselectCodemarks?: Function;
}

type Props = InheritedProps & DispatchProps & ConnectedProps;

export class Codemark extends React.Component<Props, State> {
	static defaultProps: Partial<Props> = {
		displayType: "default"
	};

	private _pollingTimer?: any;
	private _fileUri?: string;
	private _isHighlightedInTextEditor = false;
	private _range?: Range;

	constructor(props: Props) {
		super(props);
		this.state = {
			hover: false,
			isEditing: false,
			isInjecting: false,
			menuOpen: false
		};
	}

	componentDidMount() {
		const { codemark, pinnedReplies, getPosts, selected } = this.props;
		if (codemark.pinnedReplies && codemark.pinnedReplies.length > 0 && pinnedReplies.length === 0) {
			getPosts(codemark.streamId, codemark.pinnedReplies!, codemark.postId);
		}

		if (selected) {
			this.startPollingReplies(false);
			this.toggleCodeHighlightInTextEditor(true);
		}
	}

	componentDidUpdate(prevProps: Props, _prevState: State) {
		if (prevProps.selected && !this.props.selected) {
			this.stopPollingReplies();
			this.toggleCodeHighlightInTextEditor(false, true);
		} else if (this.props.selected && this._pollingTimer === undefined) {
			this.startPollingReplies(true);
			this.toggleCodeHighlightInTextEditor(true);
		}

		// if selected codemark changes, then clean up highlight in file and highlight for new codemark
		if (prevProps.codemark.id !== this.props.codemark.id && this.props.selected) {
			this.toggleCodeHighlightInTextEditor(false, true);
			this._fileUri = this._range = undefined;
			this.toggleCodeHighlightInTextEditor(true);
		}

		if (
			prevProps.marker &&
			this.props.marker &&
			prevProps.marker.range &&
			this.props.marker.range &&
			!areRangesEqual(prevProps.marker.range, this.props.marker.range)
		) {
			this._range = this.props.marker.range;
		}
	}

	componentWillUnmount() {
		this.stopPollingReplies();
		if (this._isHighlightedInTextEditor) this.toggleCodeHighlightInTextEditor(false, true);
	}

	private startPollingReplies(prefetch: boolean) {
		if (this.props.capabilities.providerSupportsRealtimeEvents) return;

		if (prefetch) {
			this.fetchReplies();
		}

		if (this._pollingTimer !== undefined) return;

		this._pollingTimer = setInterval(() => {
			if (this.props.editorHasFocus) {
				this.fetchReplies();
			}
		}, 5000);
	}

	private stopPollingReplies() {
		if (this._pollingTimer === undefined) return;

		clearInterval(this._pollingTimer);
		this._pollingTimer = undefined;
	}

	private async fetchReplies() {
		const postId = this.props.codemark.postId;
		// because the codemark is created before the third party chat post,
		// `postId` can be undefined for a period. in the case of ms teams at least,
		// that period can be long enough that if a user attempts to expand the newly created codemark,
		// postId will still be nil
		if (isNil(postId) || postId === "") return;

		return this.props.fetchThread(this.props.codemark.streamId, this.props.codemark.postId);
	}

	render() {
		if (this.state.isEditing)
			return (
				<div className="editing-codemark-container">
					<CodemarkForm
						isEditing
						editingCodemark={this.props.codemark}
						commentType={this.props.codemark.type}
						onSubmit={this.editCodemark}
						onClickClose={this.cancelEditing}
						streamId={this.props.codemark.streamId}
						collapsed={false}
					/>
				</div>
			);

		switch (this.props.displayType) {
			case "collapsed":
				return this.renderCollapsedCodemark();
			case "default":
			default:
				return this.renderInlineCodemark();
		}
	}

	cancelEditing = () => {
		this.setState({ isEditing: false });
	};

	cancelInjecting = () => {
		this.setState({ isInjecting: false });
	};

	inject = () => {};

	editCodemark = async ({ text, assignees, title, relatedCodemarkIds, tags }) => {
		await this.props.editCodemark(this.props.codemark.id, {
			text,
			title,
			assignees,
			relatedCodemarkIds,
			tags
		});
		this.setState({ isEditing: false });
	};

	renderTextLinkified = text => {
		let html;
		if (text == null || text === "") {
			html = "";
		} else {
			const me = this.props.currentUser.username;
			html = markdownify(text).replace(/@(\w+)/g, (match: string, name: string) => {
				if (
					this.props.usernames.some(
						n => name.localeCompare(n, undefined, { sensitivity: "accent" }) === 0
					)
				) {
					return `<span class="at-mention${
						me.localeCompare(name, undefined, { sensitivity: "accent" }) === 0 ? " me" : ""
					}">${match}</span>`;
				}

				return match;
			});

			if (this.props.query) {
				const matchQueryRegexp = new RegExp(this.props.query, "gi");
				html = html.replace(matchQueryRegexp, "<u><b>$&</b></u>");
			}
		}

		return <span className="title" dangerouslySetInnerHTML={{ __html: html }} />;
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

	renderTagsAndAssigneesSelected = codemark => {
		const renderedTagsSelected = this.renderTagsSelected(codemark);
		const renderedAssigneesSelected = this.renderAssigneesSelected(codemark);

		if (renderedTagsSelected && renderedAssigneesSelected) {
			return (
				<div className="related-row" style={{ display: "flex" }}>
					{renderedTagsSelected}
					{renderedAssigneesSelected}
				</div>
			);
		} else {
			return [renderedTagsSelected, renderedAssigneesSelected];
		}
	};

	renderTagsSelected = codemark => {
		const renderedTags = this.renderTags(codemark);

		if (!renderedTags) return null;

		// we use a 5px margin bottom instead of the standard 10px of the .related
		// style because each tag has a 5px bottom margin
		return (
			<div className="related">
				<div className="related-label">Tags</div>
				<div style={{ marginBottom: "-5px" }}>
					{renderedTags}
					<div style={{ clear: "both" }} />
				</div>
			</div>
		);
	};

	renderAssigneesSelected = codemark => {
		const renderedAssignees = this.renderAssignees(codemark, true);

		if (!renderedAssignees) return null;

		return (
			<div className="related">
				<div className="related-label">Assignees</div>
				{renderedAssignees}
				<div style={{ clear: "both" }} />
			</div>
		);
	};

	renderTags = codemark => {
		let { tags = [] } = codemark;
		const { teamTagsHash, selected } = this.props;
		const { hover } = this.state;

		const title = hover && !selected ? "Show matching tags" : "";

		// LEGACY (backward compat) we used to store one "color" property on a codemark
		// so now we promote it to a tag if it exists. We should remove this code if we
		// do a data migration that removes ".color" attributes and replaces them with
		// tags. note that we don't do any backward compat if tags have been set
		if (tags.length === 0 && codemark.color) {
			const tag = { id: "_" + codemark.color, label: "", color: codemark.color };
			return <Tag tag={tag} title={title} placement="bottom" />;
		}

		return tags.length === 0
			? null
			: tags.map(tagId => {
					const tag = teamTagsHash[tagId];
					return tag ? <Tag tag={tag} title={title} placement="bottom" /> : null;
			  });
	};

	renderRelatedCodemarks = () => {
		const { relatedCodemarkIds } = this.props;

		if (relatedCodemarkIds.length === 0) return null;

		return (
			<div className="related" key="related-codemarks">
				<div className="related-label">Related</div>
				{relatedCodemarkIds.map(id => (
					<RelatedCodemark id={id} />
				))}
				<div style={{ clear: "both" }} />
			</div>
		);
	};

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

		if (this.state.isInjecting) return null;

		if (type === CodemarkType.Issue) {
			if (this.props.displayType === "default") {
				return (
					<Tooltip title="Mark as resolved and hide discussion" placement="topRight" delay={1}>
						<div
							className={cx("resolve-button", { checked: status === "closed" })}
							onClick={this.handleClickStatusToggle}
						>
							{status === "open" ? "Resolve" : "Reopen"}
						</div>
					</Tooltip>
				);
			} else {
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
		}
		return null;
	}

	handleClickCodemark = (event: React.MouseEvent): any => {
		const target = event && (event.target as HTMLElement);

		if (this.state.isInjecting) return false;

		if (target) {
			if (
				target.tagName === "A" ||
				target.closest(".post.reply") ||
				target.closest(".external-provider")
			)
				return false;
		}

		if (target && (target.classList.contains("info") || target.closest(".info"))) {
			return false;
		}

		event.preventDefault();

		// in codemarkview, toggling by the header doesn't seem like a good idea
		// if (this.props.selected) {
		// 	if (target && (target.classList.contains("header") || target.closest(".header"))) {
		// 		this.props.setCurrentCodemark();
		// 	}
		// 	if (target && target.closest(".related-codemarks")) {
		// 		this.props.setCurrentCodemark();
		// 	}
		// 	return;
		// }

		const selection = window.getSelection();
		if (selection != null && selection.toString().length > 0) {
			// in this case the user has selected a string
			// by dragging
			return;
		}

		if (!this.props.selected) {
			HostApi.instance.track(
				"Codemark Clicked",
				this.props.contextName && {
					"Codemark Location": this.props.contextName
				}
			);
		}

		if (this.props.onClick) {
			this.props.onClick(event, this.props.codemark, this.props.marker);
		} else {
			if (!this.props.selected) this.props.setCurrentCodemark(this.props.codemark.id);
		}
	};

	async toggleCodeHighlightInTextEditor(highlight: boolean, forceRemoval = false) {
		// don't do anything if trying to highlight already highlighted code
		if (highlight && this._isHighlightedInTextEditor) return;
		// require explicitly forcing de-highlighting while selected
		if (this.props.selected && this._isHighlightedInTextEditor && !forceRemoval) return;

		if (!this._range || !this._fileUri) {
			const marker =
				this.props.marker || (this.props.codemark.markers && this.props.codemark.markers[0]);
			if (marker == undefined) return;

			const response = await HostApi.instance.send(GetDocumentFromMarkerRequestType, {
				markerId: marker.id
			});
			// TODO: What should we do if we don't find the marker?
			if (response == undefined) return;

			this._fileUri = response.textDocument.uri;
			this._range = response.range;
		}

		this._isHighlightedInTextEditor = highlight;
		HostApi.instance.send(EditorHighlightRangeRequestType, {
			uri: this._fileUri,
			range: this._range,
			highlight: highlight
		});
	}

	handleMouseEnterCodemark = (event: React.MouseEvent): any => {
		event.preventDefault();
		this.setState({ hover: true });
		this.props.highlightCodeInTextEditor && this.toggleCodeHighlightInTextEditor(true);
	};

	handleMouseLeaveCodemark = (event: React.MouseEvent): any => {
		event.preventDefault();
		this.setState({ hover: false });
		this.props.highlightCodeInTextEditor && this.toggleCodeHighlightInTextEditor(false);
	};

	handleMenuClick = (event: React.MouseEvent) => {
		event.stopPropagation();
		this.setState({ menuOpen: !this.state.menuOpen, menuTarget: event.target });
	};

	handleSelectMenu = action => {
		this.setState({ menuOpen: false });

		if (!action) return;

		switch (action) {
			case "toggle-pinned": {
				this.setPinned(!this.props.codemark.pinned);
				break;
			}
			case "delete-post": {
				this.deleteCodemark();
				break;
			}
			case "edit-post": {
				// TODO: ideally should also open the <CodemarkView/> but that's more complicated
				// if (!this.props.selected) this.props.setCurrentCodemark(this.props.codemark.id);
				this.setState({ isEditing: true });
				break;
			}
			case "inject": {
				this.setState({ isInjecting: true });
				break;
			}
		}
		var found = action.match(/set-keybinding-(\d)/);
		if (found) this.setKeybinding(found[1]);
	};

	deleteCodemark() {
		confirmPopup({
			title: "Are you sure?",
			message: "Deleting a codemark cannot be undone.",
			centered: true,
			buttons: [
				{
					label: "Delete Codemark",
					wait: true,
					action: () => {
						this.props.deleteCodemark(this.props.codemark.id);
					}
				},
				{ label: "Cancel" }
			]
		});
	}

	setPinned = value => {
		const { codemark } = this.props;
		if (!codemark) return;

		// if it's pinned, we're hiding/archiving/unpinning it
		if (!value) {
			if (this.props.deselectCodemarks) this.props.deselectCodemarks();
		}

		HostApi.instance.send(SetCodemarkPinnedRequestType, {
			codemarkId: codemark.id,
			value
		});
	};

	toggleLabelIndicators = (_event: React.SyntheticEvent) => {
		// event.stopPropagation();
		// HostApi.instance.send(UpdateConfigurationRequestType, {
		// 	name: "showLabelText",
		// 	value: !this.props.showLabelText
		// });
		// this.setState({ showLabelText: !this.state.showLabelText });
	};

	renderCollapsedCodemark() {
		const { codemark } = this.props;
		const file = codemark.markers && codemark.markers[0] && codemark.markers[0].file;

		if (!codemark) return null;

		return (
			<div
				className={cx("codemark collapsed")}
				onClick={this.handleClickCodemark}
				onMouseEnter={this.handleMouseEnterCodemark}
				onMouseLeave={this.handleMouseLeaveCodemark}
			>
				<div className="contents">
					{this.renderStatus(codemark)}
					<div className="body">
						<span className={codemark.color}>{this.renderTypeIcon()}</span>
						{this.renderTextLinkified(codemark.title || codemark.text)}
						{file && <span className="file-name">{file}</span>}
					</div>
				</div>
			</div>
		);
	}

	setKeybinding(key) {
		const { codemark, codemarkKeybindings } = this.props;

		const bindings = { ...codemarkKeybindings };

		for (const [k, codemarkId] of Object.entries(codemarkKeybindings)) {
			if (codemarkId !== codemark.id) continue;

			bindings[k] = "";
		}
		bindings[key] = codemark.id;

		this.props.setUserPreference(["codemarkKeybindings"], bindings);
	}

	renderKeybinding(codemark) {
		const { codemarkKeybindings } = this.props;

		const found = Object.entries(codemarkKeybindings).find(
			([, codemarkId]) => codemarkId === codemark.id
		);
		if (found == null) return null;

		const [index] = found;
		if (parseInt(index, 10) > 0) {
			const modifier = navigator.appVersion.includes("Macintosh") ? "^ /" : "Ctrl-Shift-/";
			return (
				<div style={{ float: "right", marginRight: "5px", opacity: 0.6 }}>
					<span className="keybinding extra-pad">{modifier}</span>
					<span className="keybinding extra-pad">{index}</span>
				</div>
			);
		}

		return null;
	}

	renderAttachments = post => {
		if (post.files && post.files.length) {
			return post.files.map(file => {
				// console.log(file);
				//<img src={preview.url} width={preview.width} height={preview.height} />
				const { type, url, name, title, preview } = file;
				if (type === "image") {
					return (
						<div className="thumbnail">
							<a href={url}>{title}</a>
						</div>
					);
				} else if (type === "post") {
					return (
						<div className="external-post">
							<a href={url}>{title}</a>
							<div className="preview" dangerouslySetInnerHTML={{ __html: preview }} />
						</div>
					);
				} else {
					return (
						<div className="attachment">
							<a href={url}>{title}</a>
							<pre>
								<code>{preview}</code>
							</pre>
						</div>
					);
				}
			});
		}
		return null;
	};

	renderReplyCount = post => {
		let message = "";
		const { codemark } = this.props;

		if (!codemark) return null;

		const numReplies = codemark.numReplies || "0";
		switch (codemark.type) {
			case "question":
				message = numReplies === 1 ? "1 Answer" : `${numReplies} Answers`;
				break;
			default:
				message = numReplies === 1 ? "1 Reply" : `${numReplies} Replies`;
				break;
		}
		return <a className="num-replies">{message}</a>;
	};

	renderAssignees = (codemark: CodemarkPlus, showNames?: boolean) => {
		const { hover } = this.state;
		const { selected } = this.props;

		let assigneeIcons: any = null;

		const { teammates } = this.props;
		if (teammates) {
			const assignees = (codemark.assignees || [])
				.map(id => teammates.find(t => t.id === id))
				.filter(Boolean) as CSUser[];
			const externalAssignees = (codemark.externalAssignees || [])
				.filter(user => !assignees.find(a => a.email === user.email))
				.filter(Boolean)
				.map(a => ({ fullName: a.displayName, email: a.email }));

			const assigneeHeadshots = [...assignees, ...externalAssignees].map(a => {
				if (hover && !selected) {
					return (
						<Tooltip
							title={"Assigned to " + (a.fullName || a.email)}
							placement="bottomRight"
							align={{ offset: [17, 4] }}
						>
							<span>
								<Headshot size={18} person={a} />
							</span>
						</Tooltip>
					);
				} else if (showNames) {
					return (
						<div style={{ marginTop: "3px" }}>
							<Headshot size={18} person={a} />
							{a.fullName || a.email}
						</div>
					);
				} else return <Headshot size={18} person={a} />;
			});

			if (assigneeHeadshots.length > 0) {
				assigneeIcons = <span className="assignees">{assigneeHeadshots}</span>;
			}
		}
		return assigneeIcons;
	};

	renderExternalLink = codemark => {
		if (codemark.externalProviderUrl) {
			const providerDisplay = PROVIDER_MAPPINGS[codemark.externalProvider];
			if (!providerDisplay) {
				return null;
			}
			return (
				<div className="related">
					<div className="related-label">Open on</div>
					<a className="external-link" href={codemark.externalProviderUrl}>
						{providerDisplay.icon && (
							<span>
								<Icon name={providerDisplay.icon} />
							</span>
						)}
						{providerDisplay.displayName}
						<span className="external-url">{codemark.externalProviderUrl}</span>
					</a>
				</div>
			);
		}
		return null;
	};

	renderDetailIcons = codemark => {
		const { hover } = this.state;
		const { selected, relatedCodemarkIds } = this.props;

		const hasDescription = codemark.title && codemark.text;
		const hasReplies = codemark.numReplies > 0;

		let externalLink: any = null;
		if (codemark.externalProviderUrl) {
			//@ts-ignore
			const providerDisplay = PROVIDER_MAPPINGS[codemark.externalProvider];
			if (!providerDisplay) return null;
			const icon = providerDisplay.icon;
			if (!icon) return null;
			externalLink = (
				<span
					className="detail-icon"
					onClickCapture={e => {
						e.preventDefault();
						HostApi.instance.send(OpenUrlRequestType, { url: codemark.externalProviderUrl });
					}}
				>
					<Icon
						title={hover && !selected ? "Open on " + providerDisplay.displayName : undefined}
						placement="bottom"
						name={icon}
						className="external-provider"
					/>
				</span>
			);
		}

		const renderedTags = this.renderTags(codemark);

		const renderedAssignees = this.renderAssignees(codemark);

		if (
			relatedCodemarkIds.length ||
			renderedTags ||
			externalLink ||
			hasDescription ||
			hasReplies ||
			renderedAssignees
		) {
			return (
				<div className="detail-icons">
					{renderedTags}
					{renderedAssignees}
					{externalLink}
					{hasDescription && (
						<span className="detail-icon">
							<Icon
								title={hover && !selected ? "Show description" : undefined}
								placement="bottom"
								name="description"
							/>
						</span>
					)}
					{relatedCodemarkIds.length > 0 && (
						<span className="detail-icon">
							<Icon
								title={hover && !selected ? "Show related codemarks" : undefined}
								placement="bottom"
								name="codestream"
							/>{" "}
							{relatedCodemarkIds.length}
						</span>
					)}
					{hasReplies && (
						<span className="detail-icon">
							<Icon
								title={hover && !selected ? "Show replies" : undefined}
								placement="bottom"
								name="comment"
							/>{" "}
							{this.props.isCodeStreamTeam && codemark.numReplies}
						</span>
					)}
				</div>
			);
		} else return name;
	};

	renderInlineCodemark() {
		const { codemark, codemarkKeybindings, hidden, selected, author } = this.props;
		const { menuOpen, menuTarget, isInjecting } = this.state;

		if (!codemark) return null;

		const type = codemark && codemark.type;

		const mine = author.id === this.props.currentUser.id;

		let menuItems: any[] = [
			// { label: "Add Reaction", action: "react" },
			// { label: "Get Permalink", action: "get-permalink" },
			// { label: "-" }
		];

		if (codemark.pinned) {
			menuItems.push({ label: "Archive", action: "toggle-pinned" });
		} else {
			menuItems.push({ label: "Unarchive", action: "toggle-pinned" });
		}

		if (mine) {
			menuItems.push(
				{ label: "Edit", action: "edit-post" },
				{ label: "Delete", action: "delete-post" }
			);
		}

		menuItems.push({ label: "Inject as Inline Comment", action: "inject" });

		const submenu = range(1, 10).map(index => {
			const inUse = codemarkKeybindings[index] ? " (in use)" : "";
			return {
				label: `${index}${inUse}`,
				action: `set-keybinding-${index}`
			};
		});

		menuItems.push({ label: "Set Keybinding", action: "set-keybinding", submenu: submenu });

		const description =
			codemark.title && codemark.text ? this.renderTextLinkified(codemark.text) : null;
		return (
			<div
				className={cx("codemark inline type-" + type, {
					// if it's selected, we don't render as hidden
					"cs-hidden": !selected ? hidden : false,
					// collapsed: !selected,
					selected: selected,
					unpinned: !codemark.pinned,
					injecting: isInjecting
				})}
				onClick={this.handleClickCodemark}
				onMouseEnter={this.handleMouseEnterCodemark}
				onMouseLeave={this.handleMouseLeaveCodemark}
			>
				<div className="contents">
					{(selected || !hidden) && !codemark.pinned && (
						<div className="archived">This codemark is archived</div>
					)}
					<div className="body">
						<div className="header">
							{!selected && type === "bookmark" ? (
								<>
									<span className={codemark.color}>{this.renderTypeIcon()}</span>
									{this.renderTextLinkified(codemark.title || codemark.text)}
									<div className="right">
										<span onClick={this.handleMenuClick}>
											{menuOpen && (
												<Menu
													items={menuItems}
													target={menuTarget}
													action={this.handleSelectMenu}
												/>
											)}
											<Icon name="kebab-vertical" className="kebab-vertical clickable" />
										</span>
									</div>
								</>
							) : (
								<>
									<div className="author">
										<Headshot person={author} />
										{author.username}
										<Timestamp time={codemark.createdAt} />
									</div>
									<div className="right">
										<span onClick={this.handleMenuClick}>
											<Icon name="kebab-vertical" className="kebab-vertical clickable" />
										</span>
										{this.renderKeybinding(codemark)}
										{this.renderStatus(codemark)}
										{menuOpen && (
											<Menu items={menuItems} target={menuTarget} action={this.handleSelectMenu} />
										)}
									</div>
								</>
							)}
						</div>
						<div
							style={{ position: "absolute", top: "5px", right: "5px" }}
							onClick={this.handleMenuClick}
						>
							{menuOpen && (
								<Menu items={menuItems} target={menuTarget} action={this.handleSelectMenu} />
							)}
						</div>
						{!isInjecting && (selected || type !== "bookmark")
							? this.renderTextLinkified(codemark.title || codemark.text)
							: null}
						{!selected && !isInjecting && this.renderPinnedReplies()}
						{!selected && !isInjecting && this.renderDetailIcons(codemark)}
						{isInjecting && (
							<InjectAsComment
								cancel={this.cancelInjecting}
								setPinned={this.setPinned}
								codemark={codemark}
								author={author}
							></InjectAsComment>
						)}
					</div>
					{selected && !isInjecting && (
						<CodemarkDetails
							codemark={codemark}
							author={this.props.author}
							postAction={this.props.postAction}
						>
							<div className="description">
								{this.renderTagsAndAssigneesSelected(codemark)}
								{description && (
									<div className="related">
										<div className="related-label">Description</div>
										<div className="description-body" style={{ display: "flex" }}>
											<Icon name="description" />
											<div className="description-text" style={{ paddingLeft: "5px" }}>
												{description}
											</div>
										</div>
									</div>
								)}
								{this.renderExternalLink(codemark)}
								{this.renderRelatedCodemarks()}
								{this.renderPinnedRepliesSelected()}
							</div>
						</CodemarkDetails>
					)}
					{this.state.hover && !selected && type !== "bookmark" && (
						<div className="info-wrapper">
							<Icon
								className="info"
								title={this.renderCodemarkFAQ()}
								placement="bottomRight"
								delay={1}
								name="info"
							/>
						</div>
					)}
				</div>
			</div>
		);
	}

	renderPinnedRepliesSelected() {
		const renderedPinnedReplies = this.renderPinnedReplies();

		if (renderedPinnedReplies) {
			return (
				<div className="related">
					<div className="related-label">Starred Replies</div>
					<div style={{ margin: "-5px 0 0 0" }}>{renderedPinnedReplies}</div>
				</div>
			);
		} else return null;
	}

	renderPinnedReplies() {
		const { pinnedReplies = [] } = this.props;

		if (pinnedReplies.length === 0) return null;
		return (
			<div className="pinned-replies">
				{pinnedReplies.map((post, i) => {
					return (
						<div className="pinned-reply">
							<Icon className="pinned-reply-star" name="star" />{" "}
							<Headshot size={18} person={this.props.pinnedAuthors[i]} />
							<div className="pinned-reply-body">{this.renderTextLinkified(post.text)}</div>
						</div>
					);
				})}
			</div>
		);
	}

	renderCodemarkFAQ() {
		return (
			<div className="codemark-faq">
				Just like Twitter has Tweets, CodeStream uses Codemarks as a unit of conversation.
				<ul style={{ paddingLeft: "20px" }}>
					<li>
						Codemarks are <b>branch-agnostic</b>. That means this codemark will appear "in the right
						place" even for your teammates who are checked out to a different version of this file.{" "}
						<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
							learn more
						</a>
					</li>
					<li>
						Codemarks <b>move with the code</b>, so your conversation remains connected to the right
						code block even as your code changes.{" "}
						<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
							learn about comment drift
						</a>
					</li>
					<li>
						Codemarks <b>can be managed</b> by archiving or deleting them if they're no longer
						relevant.{" "}
						<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
							see how
						</a>
					</li>
					<li>
						<b>Replies can be promoted</b> with a <Icon name="star" /> so the best answer surfaces
						to the top, like in stack overflow.{" "}
						<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
							see how
						</a>
					</li>
				</ul>
			</div>
		);
	}

	renderDemoShit(codemark) {
		const user = {
			username: "pez",
			email: "pez@codestream.com",
			fullName: "Peter Pezaris"
		};
		return (
			<div>
				{codemark.text &&
					codemark.text.startsWith("does this") && [
						<div className="pinned-reply">
							<Icon name="star" /> <Headshot size={18} person={user} />
							<div className="pinned-reply-body">
								no; the javascript byte compiler optimizes it away
							</div>
						</div>,
						<div className="pinned-reply">
							<Icon name="star" /> <Headshot size={18} person={user} />
							<div className="pinned-reply-body">are you sure?</div>
						</div>
					]}
				{codemark.title && codemark.title.startsWith("let's avoid") && (
					<div className="pinned-reply">
						<Icon name="star" /> <Headshot size={18} person={user} />
						<div className="pinned-reply-body">i'll grab this in the next sprint</div>
					</div>
				)}
				{codemark.text && codemark.text.startsWith("how does") && (
					<div className="pinned-reply">
						<Icon name="star" /> <Headshot size={18} person={user} />
						<div className="pinned-reply-body">
							Sample <code>n</code> random values from a collection using the modern version of the{" "}
							<b>Fisher-Yates</b> shuffle. If <code>n</code> is not specified, returns a single
							random element. The internal <code>guard</code> argument allows it to work with{" "}
							<code>map</code>.
						</div>
					</div>
				)}
			</div>
		);
	}
}

const EMPTY_OBJECT = {};
const EMPTY_ARRAY = [];

const unkownAuthor = {
	username: "CodeStream",
	fullName: "Uknown User"
};

const mapStateToProps = (state: CodeStreamState, props: InheritedProps): ConnectedProps => {
	const { capabilities, context, preferences, users, session, posts } = state;
	const { codemark } = props;

	const teamProvider = getCurrentTeamProvider(state);

	const pinnedReplies = (codemark.pinnedReplies || EMPTY_ARRAY)
		.map(id => getPost(posts, codemark.streamId, id))
		.filter(Boolean);

	const pinnedAuthors = pinnedReplies.map(post => users[post.creatorId]);

	const relatedCodemarkIds = codemark.relatedCodemarkIds || EMPTY_ARRAY;

	const teamTagsHash = getTeamTagsHash(state);

	return {
		capabilities: capabilities,
		editorHasFocus: context.hasFocus,
		pinnedReplies,
		pinnedAuthors,
		relatedCodemarkIds,
		currentUser: users[session.userId!] as CSMe,
		author: getUserByCsId(users, props.codemark.creatorId) || (unkownAuthor as CSUser),
		codemarkKeybindings: preferences.codemarkKeybindings || EMPTY_OBJECT,
		isCodeStreamTeam: teamProvider === "codestream",
		teammates: getTeamMembers(state),
		usernames: getUsernames(state),
		teamTagsHash
	};
};

export default connect(
	// @ts-ignore
	mapStateToProps,
	{
		setCodemarkStatus,
		setUserPreference,
		deleteCodemark,
		editCodemark,
		fetchThread,
		getPosts,
		setCurrentCodemark
	}
	// @ts-ignore
)(Codemark);
