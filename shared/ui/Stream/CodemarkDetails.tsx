import React from "react";
import { connect } from "react-redux";
import cx from "classnames";
import Button from "./Button";
import PostList from "./PostList";
import Tooltip from "./Tooltip";
import { MessageInput } from "./MessageInput";
import { findMentionedUserIds, getTeamMembers } from "../store/users/reducer";
import CodemarkActions from "./CodemarkActions";
import { CodemarkPlus, Capabilities } from "@codestream/protocols/agent";
import { createPost } from "./actions";
import { CSUser, CSMe, CSPost } from "@codestream/protocols/api";
import { getTeamProvider } from "../store/teams/reducer";
import { replaceHtml } from "../utils";
import { DelayedRender } from "../Container/DelayedRender";
import { localStore } from "../utilities/storage";

interface State {
	editingPostId?: string;
	text: string;
	formatCode: boolean;
	isLoadingReplies: boolean;
}

interface Props {
	author: CSUser;
	codemark: CodemarkPlus;
	teammates: CSUser[];
	currentUserId: string;
	slashCommands?: any;
	services?: any;
	teamProvider: "codestream" | "slack" | "msteams" | string;
	height?: Number;
	capabilities: Capabilities;
	hasFocus: boolean;
	currentUserName: string;
	teamId: string;
	displayType?: "collapsed" | "default" | "activity";

	onSubmitPost?: any;
	createPost(...args: Parameters<typeof createPost>): ReturnType<ReturnType<typeof createPost>>;
	postAction?(...args: any[]): any;
}

export class CodemarkDetails extends React.Component<Props, State> {
	private postList = React.createRef();

	constructor(props: Props) {
		super(props);
		this.state = {
			text: this.getCachedText(),
			formatCode: false,
			isLoadingReplies: true
		};
	}

	getCachedText() {
		const replyCache = localStore.get("replyCache");
		if (!replyCache) return "";

		return replyCache[this.props.codemark.id] || "";
	}

	cacheText(text: string) {
		let replyCache = localStore.get("replyCache");
		if (!replyCache) replyCache = {};

		if (text === "") {
			delete replyCache[this.props.codemark.id];
		} else {
			replyCache[this.props.codemark.id] = text;
		}

		localStore.set("replyCache", replyCache);
	}

	componentDidMount() {
		const input = document.getElementById("input-div");
		if (input) input.focus();
	}

	handleClickPost() {}

	submitReply = async () => {
		const { codemark } = this.props;
		const { text, formatCode } = this.state;
		const mentionedUserIds = findMentionedUserIds(this.props.teammates, text);
		const threadId = codemark ? codemark.postId : "";
		const { createPost } = this.props;
		this.setState({ text: "" });
		this.cacheText("");

		// don't create empty replies
		if (!text.length) return;

		let replyText = formatCode ? "```" + text + "```" : text;
		await createPost(codemark.streamId, threadId, replaceHtml(replyText)!, null, mentionedUserIds, {
			entryPoint: "Codemark"
		});
	};

	handleOnChange = (text: string, formatCode: boolean) => {
		this.cacheText(text);
		this.setState({ text, formatCode });
	};

	postAction = (name: string, post: CSPost) => {
		if (name === "edit-post") {
			this.setState({ editingPostId: post.id }, () => {
				if (this.postList.current) (this.postList.current as any).scrollTo(post.id);
			});
		} else {
			this.props.postAction && this.props.postAction(name, post);
		}
	};

	cancelEdit = () => {
		this.setState({ editingPostId: undefined });
	};

	onRepliesLoaded = () => {
		this.setState({ isLoadingReplies: false });
	};

	render() {
		const { codemark, capabilities, author, currentUserId } = this.props;

		const modifier = navigator.appVersion.includes("Macintosh") ? "⌘" : "Alt";

		const submitTip = (
			<span>
				Submit Reply<span className="keybinding extra-pad">{modifier} ENTER</span>
			</span>
		);

		const threadId = codemark.postId || "";
		return (
			<div className="codemark-details">
				{this.props.children}
				<CodemarkActions
					codemark={codemark}
					isAuthor={author.id === currentUserId}
					capabilities={capabilities}
					displayType={this.props.displayType}
				/>
				<div className="replies">
					{this.props.displayType !== "activity" && (
						<div className="compose codemark-compose">
							<div className="related-label">Add Reply</div>
							<MessageInput
								teammates={this.props.teammates}
								currentUserId={this.props.currentUserId}
								slashCommands={this.props.slashCommands}
								services={this.props.services}
								teamProvider={this.props.teamProvider}
								text={this.state.text}
								placeholder="Reply..."
								onChange={this.handleOnChange}
								onSubmit={this.submitReply}
								multiCompose={true}
							/>
							<div style={{ display: "flex" }}>
								<div style={{ opacity: 0.4, paddingTop: "3px" }}>Markdown is supported</div>
								<div style={{ textAlign: "right", flexGrow: 1 }}>
									<Tooltip title={submitTip} placement="bottom" delay={1}>
										<Button
											key="submit"
											style={{
												// fixed width to handle the isLoading case
												width: "80px",
												margin: "10px 0",
												float: "right"
											}}
											className={cx("control-button", { cancel: !this.state.text })}
											type="submit"
											onClick={this.submitReply}
										>
											Submit
										</Button>
									</Tooltip>
								</div>
							</div>
						</div>
					)}
					{this.state.isLoadingReplies && (
						<DelayedRender>
							<div className="progress-container">
								<div className="progress-bar">
									<div className="progress-cursor" />
								</div>
							</div>
						</DelayedRender>
					)}
					<div className="postslist threadlist" onClick={this.handleClickPost}>
						<PostList
							onDidInitialize={this.onRepliesLoaded}
							ref={this.postList}
							reverse={true}
							isActive={true}
							hasFocus={this.props.hasFocus}
							teammates={this.props.teammates}
							currentUserId={this.props.currentUserId}
							currentUserName={this.props.currentUserName}
							editingPostId={this.state.editingPostId}
							postAction={this.postAction}
							streamId={this.props.codemark.streamId}
							isThread
							threadId={threadId}
							teamId={this.props.teamId}
							skipParentPost={true}
							onCancelEdit={this.cancelEdit}
							onDidSaveEdit={this.cancelEdit}
							disableEdits
							renderHeaderIfPostsExist="Activity"
						/>
					</div>
				</div>
			</div>
		);
	}

	handleSubmitPost = (...args) => {
		this.props.onSubmitPost(...args);
	};
}

const EMPTY_OBJECT = {};
const mapStateToProps = state => {
	const { capabilities, configs, connectivity, session, context, users, teams, services } = state;

	const team = teams[context.currentTeamId];
	const teamProvider = getTeamProvider(team);
	const teamMembers = getTeamMembers(state);

	const user: CSMe = users[session.userId];

	const providerInfo =
		(user.providerInfo && user.providerInfo[context.currentTeamId]) || EMPTY_OBJECT;

	return {
		threadId: context.threadId,
		configs,
		capabilities,
		isOffline: connectivity.offline,
		teammates: teamMembers,
		providerInfo,
		teamId: context.currentTeamId,
		teamName: team.name || "",
		repoId: context.currentRepoId,
		hasFocus: context.hasFocus,
		currentUserId: user.id,
		currentUserName: user.username,
		services,
		teamProvider: teamProvider
	};
};

export default connect(
	mapStateToProps,
	{ createPost }
)(CodemarkDetails);
