import React, { PropsWithChildren } from "react";
import { Carousel, Content } from "../src/components/Carousel";
import styled from "styled-components";
import Icon from "./Icon";
import { useRect } from "../utilities/hooks";
import { ComposeKeybindings } from "./ComposeTitles";

const Root = styled.div`
	color: var(--text-color);
	position: relative;
	h2,
	h3 {
		color: var(--text-color-highlight);
	}

	h3 {
		margin: 30px 0 5px 0;
	}
	${Carousel} {
		display: inline-block;
		max-width: 600px;
	}
`;

const Diagram = styled.div`
	position: relative;
	display: inline-block;
	width: 600px;
	height: 175px;
	transform-origin: top left;
	// background: rgba(127, 127, 127, 0.05);
`;

const Contents = styled.div`
	position: absolute;
	top: 0;
	bottom: 0;
	left: 0;
	right: 0;
`;

const GitTimeline = styled.div`
	position: absolute;
	top: 30px;
	width: 100%;
	height: 3px;
	background: #999;
	margin-top: -1px;

	&:after {
		content: "";
		position: absolute;
		right: -6px;
		top: -5px;
		width: 0;
		height: 0;
		border-top: 7px solid transparent;
		border-left: 15px solid #999;
		border-bottom: 7px solid transparent;
	}
`;

const BranchLineDown = styled.div`
	position: absolute;
	width: 3px;
	background: #999;
	height: 50px;
	top: 50px;
	left: 70px;
`;

const BranchCurve = styled.div`
	position: absolute;
	top: 75px;
	left: 70px;
	width: 3px;
	width: 50px;
	height: 50px;
	border: 3px solid #999;
	border-color: #999 transparent transparent transparent;
	border-radius: 50%;
	transform: rotate(225deg);
`;

const BranchLineAcross = styled.div`
	position: absolute;
	height: 3px;
	width: 186px;
	background: #999;
	top: 122px;
	left: 95px;
`;

const MergeLineDown = styled.div`
	position: absolute;
	width: 3px;
	background: #999;
	height: 50px;
	top: 50px;
	right: 70px;
`;

const MergeLineAcross = styled.div`
	position: absolute;
	height: 3px;
	width: 106px;
	background: #999;
	top: 122px;
	left: 399px;
	z-index: 0;
`;

const MergeCurve = styled.div`
	position: absolute;
	top: 75px;
	right: 70px;
	width: 3px;
	width: 50px;
	height: 50px;
	border: 3px solid #999;
	border-color: #999 transparent transparent transparent;
	border-radius: 50%;
	transform: rotate(135deg);
`;

const Action = styled.div`
	position: absolute;
	display: flex;
	justify-content: center;
	align-items: center;
	cursor: pointer;
	width: 40px;
	height: 40px;
	border-radius: 50%;
	background: #999;
	top: 102px;
	z-index: 2;
	&:before {
		content: "";
		position: absolute;
		top: 3px;
		left: 3px;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--base-border-color);
	}
	.icon {
		display: inline-block;
		transform: scale(1.5);
	}
	transition: transform ease-out 0.2s;
	&.active {
		z-index: 3;
		background: var(--button-background-color);
		color: var(--button-foreground-color);
		&:before {
			// background: #999;
			background: var(--button-background-color);
		}
		.vscode-dark & {
			box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
		}
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
		transform: scale(1.5);
	}
`;

const GitBranch = styled(Action)`
	top: 10px;
	left: 52px;
	.icon {
		margin-left: 3px;
	}
`;

const GitMerge = styled(Action)`
	top: 10px;
	right: 52px;
	.icon {
		margin-left: 3px;
	}
`;

const Edit = styled(Action)`
	left: 120px;
`;

const Review = styled(Action)`
	left: 200px;
`;

const Comment = styled(Action)`
	top: -6px;
	left: -6px;
`;

const Issue = styled(Action)`
	top: auto;
	bottom: 0;
	left: -6px;
`;

const Amend = styled(Action)`
	top: -6px;
	right: 0;
	left: auto;
	svg {
		padding: 1px 0 0 1px;
	}
`;

const Commit = styled(Action)`
	top: auto;
	bottom: 0;
	left: auto;
	right: 0;
`;

const Approve = styled(Action)`
	left: 440px;
`;

const DiscussionCircle = styled.div`
	position: absolute;
	top: 60px;
	left: 280px;
	width: 120px;
	height: 120px;
	border: 3px solid #999;
	border-radius: 50%;
	z-index: 2;
`;

const DiscussionAnimate = styled.div`
	position: relative;
	width: 120px;
	height: 120px;
	transition: transform 1s ease-out;
	&.rotate {
		transform: rotate(360deg);
	}
	&.rotate .icon {
		transform: scale(1.5) rotate(-360deg);
	}
	z-index: 2;

	${Comment}, ${Issue}, ${Commit}, ${Amend} {
		z-index: 2;
		.icon {
			display: inline-block;
			transition: transform 1s ease-out;
		}
	}
`;

const LineCommit = styled.div`
	top: 200px;
	left: 440px;
	position: absolute;
	display: flex;
	height: 3px;
	width: 50px;
	background: #999;
	margin-top: -1px;
	&:before {
		content: "";
		position: absolute;
		top: -6px;
		left: 18px;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: #999;
	}
	&:after {
		content: "";
		position: absolute;
		top: -3px;
		left: 21px;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--base-border-color);
	}
`;

const Key = styled.span`
	font-size: 13px;
	vertical-align: 3px;
	padding-left: 5px;
	white-space: nowrap;
`;

const VideoLink = styled.a`
	display: block;
	margin-top: 30px;
	display: flex;
	align-items: center;
	> img {
		height: 22px;
		cursor: pointer;
		opacity: 0.8;
		margin-right: 5px;
	}
	> span {
		text-decoration: none !important;
	}
	&:hover > img {
		opacity: 1;
		text-shadow: 0 5px 10px rgba(0, 0, 0, 0.8);
	}
`;

export const Flow = () => {
	const [active, setActive] = React.useState(0);
	const [rotate, setRotate] = React.useState(false);
	const rootRef = React.useRef(null);
	const rootDimensions = useRect(rootRef, []);
	const scale = Math.min(rootDimensions.width / 600, 1);

	const click = index => {
		setActive(index);
		if (index === 3) setRotate(!rotate);
	};

	return (
		<Root ref={rootRef}>
			<p>
				CodeStream Flow is an ultra-lightweight, discussion-based workflow that supports teams and
				projects where code is reviewed and merged regularly. This guide explains how CodeStream can
				make every step of the process easier for you and your team.
			</p>
			<div
				style={{
					transform: `scale(${scale})`,
					position: "absolute",
					width: "100%",
					transformOrigin: "top left",
					textAlign: "center"
				}}
			>
				<Diagram>
					<Contents>
						<GitTimeline />
						<BranchLineDown />
						<BranchCurve />
						<BranchLineAcross />
						<GitBranch className={active === 0 ? "active" : ""} onClick={() => click(0)}>
							<Icon name="git-branch" />
						</GitBranch>
						<Edit className={active === 1 ? "active" : ""} onClick={() => click(1)}>
							<Icon name="pencil" />
						</Edit>
						<Review className={active === 2 ? "active" : ""} onClick={() => click(2)}>
							<Icon name="review" />
						</Review>
						<DiscussionCircle>
							<DiscussionAnimate className={rotate ? "rotate" : ""}>
								<Comment className={active === 3 ? "active" : ""} onClick={() => click(3)}>
									<Icon name="comment" />
								</Comment>
								<Issue className={active === 3 ? "active" : ""} onClick={() => click(3)}>
									<Icon name="issue" />
								</Issue>
								<Amend className={active === 3 ? "active" : ""} onClick={() => click(3)}>
									<Icon name="plus" />
								</Amend>
								<Commit className={active === 3 ? "active" : ""} onClick={() => click(3)}>
									<Icon name="checked-checkbox" />
								</Commit>
							</DiscussionAnimate>
						</DiscussionCircle>
						<Approve className={active === 4 ? "active" : ""} onClick={() => click(4)}>
							<Icon name="thumbsup" />
						</Approve>
						<GitMerge className={active === 5 ? "active" : ""} onClick={() => click(5)}>
							<Icon name="git-merge" />
						</GitMerge>
						<MergeLineAcross />
						<MergeCurve />
						<MergeLineDown />
					</Contents>
				</Diagram>
			</div>
			<div style={{ marginTop: `${scale * 180}px`, textAlign: "center" }}>
				<Carousel active={active} lastContent={6} onChange={value => click(value)}>
					<Content active={active === 0}>
						<h2>Create a Branch</h2>
						When you're working on a team, you're going to have a bunch of different features or
						ideas in progress at any given time – some of which are ready to go, and others which
						are not. Branching exists to help you manage this workflow.
						<br />
						<br />
						When you create a branch in your project, you're creating an environment where you can
						try out new ideas. Changes you make on a branch don't affect the master branch, so
						you're free to experiment and commit changes, safe in the knowledge that your branch
						won't be merged until it's ready to be reviewed by someone you're collaborating with.
						<h3>Exclusive</h3>
						<Icon name="trello" /> CodeStream makes it easy to connect your tickets to your branches
						(Kickstart)
						<VideoLink href={"step.video"}>
							<img src="https://i.imgur.com/9IKqpzf.png" />
							<span>How do I create a branch?</span>
						</VideoLink>
					</Content>
					<Content active={active === 1}>
						<h2>Start Writing Code</h2>
						Once your branch has been created, it's time to start making changes. Whenever you add,
						edit, or delete a file, you can share those changes with your teammates to get feedback.
						<br />
						<br />
						When you have questions about existing code, asking is as easy as selecting the code and
						typing your question. CodeStream automatically captures the context of your editor when
						sharing your question with the team, so no context switch is required for you or your
						teammates. Your teammates can participate in this discussion directly in their IDE, or
						via integrations with Slack, MS Teams, or email.
						<h3>Exclusive</h3>
						<Icon name="broadcast" /> Live View shares your changes in real-time... (Xray)
						<VideoLink href={"step.video"}>
							<img src="https://i.imgur.com/9IKqpzf.png" />
							<span>If I ask comments on my branch, how do my teammates see them?</span>
						</VideoLink>
						<VideoLink href={"step.video"}>
							<img src="https://i.imgur.com/9IKqpzf.png" />
							<span>What is Live View?</span>
						</VideoLink>
					</Content>
					<Content active={active === 2}>
						<h2>Request Feedback from Your Team</h2>
						Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
						incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
						exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
						dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
						Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
						mollit anim id est laborum.
						<h3>Exclusive</h3>
						CodeStream makes it easier to get feedback earlier in your dev cycle by disconnecting
						discussion about code with commit flow. This means you can request a review on code you
						haven't committed &amp; pushed yet, and CodeStream will take care of the mechanics of
						making sure your teammate can see the changes you have local on your machine, by
						packaging up a diffset along with the review object.
						<VideoLink href={"step.video"}>
							<img src="https://i.imgur.com/9IKqpzf.png" />
							<span>When should I request feedback?</span>
						</VideoLink>
					</Content>
					<Content active={active === 3}>
						<h2>Discuss and Refine Your Changes</h2>
						Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
						incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
						exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
						dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
						Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
						mollit anim id est laborum.
						<h3>Exclusive</h3>
						Unlike other systems, your discussion and commit cadance are disconnected. This means
						you can share and review code without worrying about committing it first.
						<VideoLink href={"step.video"}>
							<img src="https://i.imgur.com/9IKqpzf.png" />
							<span>How do I add fixes to the issues my teammates report?</span>
						</VideoLink>
					</Content>
					<Content active={active === 4}>
						<h2>Get Final Approval</h2>
						Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
						incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
						exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
						dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
						Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
						mollit anim id est laborum.
						<h3>Exclusive</h3>
						Reviewers are based on a variety of ...
						<VideoLink href={"step.video"}>
							<img src="https://i.imgur.com/9IKqpzf.png" />
							<span>How are reviewers assigned?</span>
						</VideoLink>
					</Content>
					<Content active={active === 5}>
						<h2>Create a PR and Merge</h2>
						Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
						incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
						exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
						dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
						Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
						mollit anim id est laborum.
						<h3>Exclusive</h3>
						CodeStream works with the on-prem and cloud-based versions of GitHub, GitLab, and
						BitBucket.
						<VideoLink href={"step.video"}>
							<img src="https://i.imgur.com/9IKqpzf.png" />
							<span>How do I connect to my source host provider?</span>
						</VideoLink>
					</Content>
					<Content active={active === 6}>
						<h2>Final Thought</h2>
						We built CodeStream with the goal of making it easier to discuss code and collaborate
						with your team. The two biggest hurdles to overcome were (1) creating a consistent
						in-editor code commenting experience that was as simple as "select the code, type your
						comment" across all of the popular editors, and (2) developing the algorithms that
						calculated logical positions in a file across different versions, allowing us to
						disconnect conversation cadence from commit cadence.
						<br />
						<br />
						This algorithm provides for two major advantages (comments carry forward, and works
						across branches).
					</Content>
				</Carousel>
			</div>
		</Root>
	);
};
