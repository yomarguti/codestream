import React, { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import CancelButton from "./CancelButton";
import { HostApi } from "../webview-api";
import { Button } from "../src/components/Button";
import styled from "styled-components";
import { TextInput } from "../Authentication/TextInput";
import { logError } from "../logger";
import { FormattedMessage } from "react-intl";
import cx from "classnames";
import { Link } from "./Link";
import { DropdownButton } from "./Review/DropdownButton";
import { LoadingMessage } from "../src/components/LoadingMessage";
import {
	CreatePullRequestRequestType,
	CheckPullRequestPreconditionsRequestType,
	ChangeDataType,
	DidChangeDataNotificationType
} from "@codestream/protocols/agent";
import { connectProvider } from "./actions";
import { CSMe } from "../protocols/agent/api.protocol.models";
import { isConnected } from "../store/providers/reducer";
import { CodeStreamState } from "../store";
import { inMillis } from "../utils";
import { useInterval, useTimeout } from "../utilities/hooks";

export const ButtonRow = styled.div`
	text-align: center;
	margin-top: 20px;
	button {
		width: 18em;
	}
`;
const Root = styled.div`
	#controls {
		padding-top: 10px;
	}
`;

export const CreatePullRequestPanel = props => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const currentUser = state.users[state.session.userId!] as CSMe;
		return {
			isConnectedToGitHub: isConnected(state, { name: "github" })
		};
	});
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);

	const [requiresProvider, setRequiresProvider] = useState(false);

	const [preconditionErrorType, setPreconditionErrorType] = useState("");
	const [unexpectedError, setUnexpectedError] = useState(false);
	const [providerError, setProviderError] = useState("");

	const [formInvalid, setFormInvalid] = useState(false);
	const [titleValidity, setTitleValidity] = useState(true);

	const [currentBranch, setCurrentBranch] = useState("");
	const [branches, setBranches] = useState([] as string[]);
	const [providerConnected, setProviderConnected] = useState(false);

	// states used to create the eventual pr
	const [prBranch, setPrBranch] = useState("");
	const [prTitle, setPrTitle] = useState("");
	const [prText, setPrText] = useState("");
	const [prRemote, setPrRemote] = useState("");
	const [prProviderId, setPrProviderId] = useState("");

	const [isWaiting, setIsWaiting] = useState(true);

	const stopWaiting = useCallback(() => {
		setIsWaiting(false);
	}, [isWaiting]);

	// TODO change to 30 ????
	const waitFor = inMillis(10, "sec");
	useTimeout(stopWaiting, waitFor);

	//
	//
	//
	//
	//
	//
	//
	// TODO FIXXXXXXX THIS
	//
	//
	//
	//
	//
	//
	//
	//
	const reviewId = "5ee912524a485e71a9bb9f88";

	const fetchPreconditionData = async () => {
		setPreconditionErrorType("");
		setLoading(true);

		try {
			const result = await HostApi.instance.send(CheckPullRequestPreconditionsRequestType, {
				reviewId: reviewId
			});
			if (result && result.success) {
				setCurrentBranch(result.branch!);
				setBranches(result.branches!);
				if (result.pullRequestProvider) {
					if (result.pullRequestProvider.defaultBranch) {
						setPrBranch(result.pullRequestProvider.defaultBranch!);
					}
					setProviderConnected(result.pullRequestProvider.isConnected);
				}

				setPrRemote(result.remote!);
				setPrTitle(result.review!.title!);
				setPrText(result.review!.text!);
				setPrProviderId(result.providerId!);

				setPreconditionErrorType("");
			} else if (result && result.error && result.error.type) {
				setPreconditionErrorType(result.error.type);
			}
		} catch (ex) {
			logError(`Unexpected error during pull request precondition check: ${ex.message}`, {
				reviewId
			});
			setUnexpectedError(true);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchPreconditionData().then(_ => {
			if (prProviderId) {
				dispatch(connectProvider(prProviderId, "Create Pull Request Panel"));
			}
		});
	}, [derivedState.isConnectedToGitHub, prProviderId]);

	useEffect(() => {
		const disposable = HostApi.instance.on(DidChangeDataNotificationType, (e: any) => {
			if (e.type === ChangeDataType.Commits) {
				fetchPreconditionData();
			}
		});
		return () => {
			disposable.dispose();
		};
	}, []);

	const isTitleValid = (title: string) => title != null;

	const onValidityChanged = useCallback((field: string, validity: boolean) => {
		switch (field) {
			case "title":
				setTitleValidity(validity);
				break;
			default: {
			}
		}
	}, []);

	const onSubmit = async (event: React.SyntheticEvent) => {
		setUnexpectedError(false);
		event.preventDefault();
		onValidityChanged("title", isTitleValid(prTitle));
		if (!titleValidity) return;

		setSubmitting(true);
		setProviderError("");
		try {
			const result = await HostApi.instance.send(CreatePullRequestRequestType, {
				reviewId: reviewId,
				providerId: prProviderId,
				title: prTitle,
				description: prText,
				baseRefName: prBranch,
				headRefName: currentBranch,
				remote: prRemote
			});
			if (result.error && result.error.message) {
				setProviderError(result.error.message);
			} else {
				HostApi.instance.track("Pull Request Created", {});
				props.closePanel();
			}
		} catch (error) {
			logError(`Unexpected error during pull request creation: ${error}`, {});
			setUnexpectedError(true);
		}

		setSubmitting(false);
	};

	const renderBranchesDropdown = () => {
		const items = branches!.map(_ => {
			return {
				label: _,
				key: _,
				action: () => {
					HostApi.instance
						.send(CheckPullRequestPreconditionsRequestType, {
							reviewId: reviewId,
							baseRefName: _,
							headRefName: currentBranch
						})
						.then(result => {
							if (result && result.error && result.error.type) {
								setPreconditionErrorType(result.error.type);
							}
							else {
								setPreconditionErrorType("");
								setPrBranch(_);
							}							
						});
				}
			};
		});
		if (items.length === 0) return undefined;
		return (
			<span>
				<DropdownButton variant="text" items={items}>
					<strong>{prBranch || currentBranch}</strong>
				</DropdownButton>
			</span>
		);
	};

	const renderProviderDropdown = () => {
		const items = [
			{
				// TODO get this from somewhere
				label: "GitHub",
				key: "github*com",
				action: () => {
					setPrProviderId("github*com");
					setIsWaiting(true);
					dispatch(connectProvider(prProviderId, "Create Pull Request Panel"));
					setRequiresProvider(false);
				}
			}
		];
		return (
			<span>
				<DropdownButton variant="text" items={items}>
					<strong>select service</strong>
				</DropdownButton>
			</span>
		);
	};

	const preconditionErrorMessages = () => {
		let messageText;
		if (preconditionErrorType) {
			switch (preconditionErrorType) {
				// TODO move these into en.js
				case "REPO_NOT_FOUND": {
					messageText = "Repo not found";
					break;
				}
				case "HAS_LOCAL_COMMITS": {
					messageText =
						"A PR can’t be created because the code review includes local commits. Push your changes and then try again.";
					break;
				}
				case "HAS_LOCAL_MODIFICATIONS": {
					messageText =
						"A PR can’t be created because the code review includes uncommitted changes. Commit and push your changes and then try again.";
					break;
				}
				case "HAS_PULL_REQUEST": {
					messageText = "There is already an open PR for this branch";
					break;
				}
				default: {
					messageText = "Unknown error";
				}
			}
		}
		return <div className="error-message form-error">{messageText}</div>;
	};

	// TODO dont copy/paste this
	function LoadingEllipsis() {
		const [dots, setDots] = useState(".");
		useInterval(() => {
			switch (dots) {
				case ".":
					return setDots("..");
				case "..":
					return setDots("...");
				case "...":
					return setDots(".");
			}
		}, 500);

		return <React.Fragment>{dots}</React.Fragment>;
	}

	const onClickTryAgain = (event: React.SyntheticEvent) => {
		event.preventDefault();
		if (prProviderId) {
			setRequiresProvider(true);
		}
	};

	const providerAuthenticationMessage = () => {
		return isWaiting ? (
			<strong>
				Waiting for authentication <LoadingEllipsis />
			</strong>
		) : (
			<strong>
				Authentication timed out. Please <Link onClick={onClickTryAgain}>try again</Link>.
			</strong>
		);
	};

	return (
		<Root className="full-height-panel">
			<form className="standard-form vscroll">
				<div className="panel-header">
					<CancelButton onClick={props.closePanel} />
				</div>
				<fieldset className="form-body" style={{ width: "35em", padding: "20px 0" }}>
					<div className="outline-box">
						<h3>Open a Pull Request</h3>
						{preconditionErrorType && preconditionErrorMessages()}
						{loading && <LoadingMessage>Loading repo info...</LoadingMessage>}
						{!loading &&
							!preconditionErrorType &&
							!providerConnected &&
							!requiresProvider &&
							providerAuthenticationMessage()}
						{!loading && !preconditionErrorType && !providerConnected && requiresProvider && (
							<div>Open a pull request on {renderProviderDropdown()}</div>
						)}
						{!loading && !preconditionErrorType && providerConnected && !requiresProvider && (
							<div id="controls">
								<div className="small-spacer" />
								{unexpectedError && (
									<div className="error-message form-error">
										<FormattedMessage
											id="error.unexpected"
											defaultMessage="Something went wrong! Please try again, or "
										/>
										<FormattedMessage id="contactSupport" defaultMessage="contact support">
											{text => <Link href="https://help.codestream.com">{text}</Link>}
										</FormattedMessage>
										.
									</div>
								)}
								{providerError && <div className="error-message form-error">{providerError}</div>}
								<div className="control-group">
									<span>
										Compare <strong>{currentBranch}</strong> against{" "}
									</span>
									{renderBranchesDropdown()}
								</div>
								<div className="control-group">
									<TextInput
										name="title"
										value={prTitle}
										autoFocus
										onChange={setPrTitle}
										onValidityChanged={onValidityChanged}
										validate={e => e != null}
									/>
									{/*<small className={cx("explainer", { "error-message": !titleValidity })}>
										<FormattedMessage id="pullRequest.title" />
								</small> */}
								</div>
								<div className="control-group">
									<textarea
										className="input-text"
										name="description"
										value={prText}
										onChange={e => setPrText(e.target.value)}
										placeholder="Pull request description"
									/>
								</div>
								<ButtonRow>
									<Button onClick={onSubmit} isLoading={submitting}>
										Create Pull Request
									</Button>
								</ButtonRow>
							</div>
						)}
					</div>
				</fieldset>
			</form>
		</Root>
	);
};
