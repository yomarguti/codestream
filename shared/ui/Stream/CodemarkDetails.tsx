import React from "react";
import { connect } from "react-redux";
import ScrollBox from "./ScrollBox";
import PostList from "./PostList";
import { MessageInput } from "./MessageInput";
import { getTeamMembers } from "../store/users/reducer";
import CodemarkActions from "./CodemarkActions";
import { CodemarkPlus, Capabilities } from "@codestream/protocols/agent";
import { createPost } from "./actions";
import { CSUser, CSMe } from "@codestream/protocols/api";

interface State {
	editingPostId?: string;
	text: string;
}

interface Props {
	codemark: CodemarkPlus;
	teammates: CSUser[];
	currentUserId: string;
	slashCommands?: any;
	services?: any;
	isSlackTeam: boolean;
	height?: Number;
	capabilities: Capabilities;
	hasFocus: boolean;
	currentUserName: string;
	teamId: string;
	streamId: string;

	onSubmitPost?: any;
	createPost(...args: Parameters<typeof createPost>): ReturnType<ReturnType<typeof createPost>>;
	postAction?: Function;
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
				<CodemarkActions codemark={codemark} capabilities={capabilities} />
				<div className="replies">
					<div className="shadow-overlay">
						<div className="postslist threadlist" onClick={this.handleClickPost}>
							<ScrollBox>
								<PostList
									isActive={true}
									hasFocus={this.props.hasFocus}
									teammates={this.props.teammates}
									currentUserId={this.props.currentUserId}
									currentUserName={this.props.currentUserName}
									editingPostId={this.state.editingPostId}
									postAction={this.props.postAction}
									streamId={this.props.streamId}
									isThread
									threadId={threadId}
									teamId={this.props.teamId}
									skipParentPost={true}
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
}

const EMPTY_OBJECT = {};
const mapStateToProps = state => {
	const { capabilities, configs, connectivity, session, context, users, teams, services } = state;

	const team = teams[context.currentTeamId];
	const teamMembers = getTeamMembers(state);

	const user: CSMe = users[session.userId];

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
		currentUserId: user.id,
		currentUserName: user.username,
		services,
		isSlackTeam: Boolean(
			teams[context.currentTeamId].providerInfo && teams[context.currentTeamId].providerInfo.slack
		)
	};
};

export default connect(
	mapStateToProps,
	{ createPost }
)(CodemarkDetails);
