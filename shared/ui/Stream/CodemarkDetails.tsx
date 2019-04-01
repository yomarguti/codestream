import React from "react";
import * as Path from "path-browserify";
import { connect } from "react-redux";
import { setCodemarkStatus } from "./actions";
import ScrollBox from "./ScrollBox";
import PostList from "./PostList";
import { MessageInput } from "./MessageInput";
import { getTeamMembers, getUsernamesRegexp } from "../store/users/reducer";
import PostDetails from "./PostDetails";
import { escapeHtml } from "../utils";
import { CodemarkPlus } from "@codestream/protocols/agent";
import { prettyPrintOne } from "code-prettify";
import { createPost } from "./actions";

const PostListJs: any = PostList;

interface State {
	editingPostId?: string;
	text: string;
}

interface Props {
	codemark: CodemarkPlus;
	teammates?: any;
	currentUserId?: any;
	slashCommands?: any;
	services?: any;
	isSlackTeam?: any;
	height?: Number;
	capabilities?: any;
	hasFocus: boolean;
	usernamesRegexp: string;
	currentUserName: string;
	teamId: string;
	streamId: string;
	onSubmitPost?: any;
	createPost?: any;
}

export class CodemarkDetails extends React.Component<Props, State> {
	static defaultProps = {};

	constructor(props: Props) {
		super(props);
		this.state = {
			text: ""
		};
	}

	componentDidMount() {
		const input = document.getElementById("input-div");
		if (input) input.focus();
	}

	handleClickPost() {}

	postAction() {}

	submitReply = async () => {
		const { codemark } = this.props;
		const { text } = this.state;
		// const mentionedUserIds = this.findMentionedUserIds(text, this.props.teammates);
		const mentionedUserIds = [];
		const threadId = codemark ? codemark.postId : "";
		const { createPost, streamId } = this.props;
		this.setState({ text: "" });
		await createPost(streamId, threadId, text, null, mentionedUserIds, {
			entryPoint: "Codemark"
		});
	};

	handleOnChange = (text: string) => {
		this.setState({ text: text });
	};

	render() {
		const { codemark, capabilities } = this.props;

		const threadId = codemark.postId || "";
		return (
			<div className="codemark-details">
				{this.renderCodeblock()}
				<PostDetails codemark={codemark} capabilities={capabilities} />
				<div className="replies">
					<div className="shadow-overlay">
						<div className="postslist threadlist" onClick={this.handleClickPost}>
							<ScrollBox>
								<PostListJs
									isActive={true}
									hasFocus={this.props.hasFocus}
									usernamesRegexp={this.props.usernamesRegexp}
									teammates={this.props.teammates}
									currentUserId={this.props.currentUserId}
									currentUserName={this.props.currentUserName}
									editingPostId={this.state.editingPostId}
									postAction={this.postAction}
									streamId={this.props.streamId}
									isThread
									threadId={threadId}
									teamId={this.props.teamId}
									skipFirstPost={true}
								/>
							</ScrollBox>
						</div>
					</div>
				</div>

				<div className="compose codemark-compose">
					<MessageInput
						teammates={this.props.teammates}
						currentUserId={this.props.currentUserId}
						slashCommands={this.props.slashCommands}
						services={this.props.services}
						isSlackTeam={this.props.isSlackTeam}
						text={this.state.text}
						placeholder="Reply..."
						onChange={this.handleOnChange}
						onSubmit={this.submitReply}
					/>
				</div>
			</div>
		);
	}

	handleSubmitPost = (...args) => {
		this.props.onSubmitPost(...args);
	};

	renderCodeblock() {
		const { codemark } = this.props;
		const markers = codemark.markers;
		if (!markers) return null;
		const marker = codemark.markers![0];
		if (marker === undefined) return;

		const path = marker.file || "";
		let extension = Path.extname(path).toLowerCase();
		if (extension.startsWith(".")) {
			extension = extension.substring(1);
		}

		let startLine = 1;
		// `range` is not a property of CSMarker
		/* if (marker.range) {
			startLine = marker.range.start.line;
		} else if (marker.location) {
			startLine = marker.location[0];
		} else */ if (
			marker.locationWhenCreated
		) {
			startLine = marker.locationWhenCreated[0];
		}

		const codeHTML = prettyPrintOne(escapeHtml(marker.code), extension, startLine);
		return <pre className="code prettyprint" dangerouslySetInnerHTML={{ __html: codeHTML }} />;
	}
}

const EMPTY_OBJECT = {};
const mapStateToProps = state => {
	const { capabilities, configs, connectivity, session, context, users, teams, services } = state;

	const team = teams[context.currentTeamId];
	const teamMembers = getTeamMembers(state);

	const user = users[session.userId];

	const providerInfo =
		(user.providerInfo && user.providerInfo[context.currentTeamId]) || EMPTY_OBJECT;

	return {
		streamId: context.currentStreamId,
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
		usernamesRegexp: getUsernamesRegexp(state),
		currentUserId: user.id,
		currentUserName: user.username,
		services,
		isSlackTeam:
			teams[context.currentTeamId].providerInfo && teams[context.currentTeamId].providerInfo.slack
	};
};

export default connect(
	mapStateToProps,
	{ setCodemarkStatus, createPost }
)(CodemarkDetails);
