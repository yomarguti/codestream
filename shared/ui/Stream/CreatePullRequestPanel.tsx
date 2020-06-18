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
	CheckPullRequestBranchPreconditionsRequestType,
	CheckPullRequestBranchPreconditionsResponse,
	CheckPullRequestPreconditionsRequestType,
	ChangeDataType,
	DidChangeDataNotificationType
} from "@codestream/protocols/agent";
import { connectProvider } from "./actions";
import { isConnected } from "../store/providers/reducer";
import { CodeStreamState } from "../store";
import { inMillis } from "../utils";
import { useInterval, useTimeout } from "../utilities/hooks";
import { setCurrentReview, openPanel } from "../store/context/actions";
import { PROVIDER_MAPPINGS } from "./CrossPostIssueControls/types";
import { PrePRProviderInfoModal } from "./PrePRProviderInfoModal";

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

// select service
const Step1 = props => (props.step !== 1 ? null : <div>{props.children}</div>);

// service loading
const Step2 = props => (props.step !== 2 ? null : <div>{props.children}</div>);

// form
const Step3 = props => (props.step !== 3 ? null : <div>{props.children}</div>);

export const CreatePullRequestPanel = props => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const { providers } = state;
		const codeHostProviders = Object.keys(providers).filter(id =>
			["github", "gitlab", "github_enterprise", "gitlab_enterprise"].includes(providers[id].name)
		);
		return {
			providers: providers,
			codeHostProviders: codeHostProviders,
			reviewId: state.context.currentPullRequestReviewId,
			isConnectedToGitHub: isConnected(state, { name: "github" }),
			isConnectedToGitLab: isConnected(state, { name: "gitlab" }),
			isConnectedToGitHubEnterprise: isConnected(state, { name: "github_enterprise" }),
			isConnectedToGitLabEnterprise: isConnected(state, { name: "gitlab_enterprise" })
		};
	});
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);

	const [preconditionError, setPreconditionError] = useState({ message: "", type: "" });
	const [unexpectedError, setUnexpectedError] = useState(false);

	const [formState, setFormState] = useState({ message: "", type: "" });
	const [titleValidity, setTitleValidity] = useState(true);

	const [currentBranch, setCurrentBranch] = useState("");
	const [branches, setBranches] = useState([] as string[]);
	const [providerConnecting, setProviderConnecting] = useState(false);

	// states used to create the eventual pr
	const [prBranch, setPrBranch] = useState("");
	const [prTitle, setPrTitle] = useState("");
	const [prText, setPrText] = useState("");
	const [prRemote, setPrRemote] = useState("");
	const [prProviderId, setPrProviderId] = useState("");

	const [currentStep, setCurrentStep] = useState(0);

	const [isWaiting, setIsWaiting] = useState(false);
	const [propsForPrePRProviderInfoModal, setPropsForPrePRProviderInfoModal] = useState<any>();

	const stopWaiting = useCallback(() => {
		setIsWaiting(false);
	}, [isWaiting]);

	const waitFor = inMillis(60, "sec");
	useTimeout(stopWaiting, waitFor);

	const fetchPreconditionData = async () => {
		setPreconditionError({ message: "", type: "" });
		// already waiting on a provider auth, keep using that loading ui
		if (currentStep != 2) {
			setLoading(true);
			setCurrentStep(0);
		}

		try {
			const result = await HostApi.instance.send(CheckPullRequestPreconditionsRequestType, {
				reviewId: derivedState.reviewId!
			});
			if (result && result.success) {
				setCurrentBranch(result.branch!);
				setBranches(result.branches!);
				if (result.pullRequestProvider) {
					if (result.pullRequestProvider.defaultBranch) {
						setPrBranch(result.pullRequestProvider.defaultBranch!);
					}
				}

				setPrRemote(result.remote!);
				setPrTitle(result.review!.title!);
				setPrText(result.review!.text!);
				setPrProviderId(result.providerId!);

				setCurrentStep(3);
				setPreconditionError({ message: "", type: "" });
			} else if (result && result.error && result.error.type) {
				if (result.error.type === "REQUIRES_PROVIDER") {
					setCurrentStep(1);
				} else {
					setPreconditionError({
						message: result.error.message || "",
						type: result.error.type || "UNKNOWN"
					});
				}
			}
		} catch (ex) {
			logError(`Unexpected error during pull request precondition check: ${ex.message}`, {
				reviewId: derivedState.reviewId
			});
			setUnexpectedError(true);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchPreconditionData();
	}, [
		derivedState.isConnectedToGitHub,
		derivedState.isConnectedToGitLab,
		derivedState.isConnectedToGitHubEnterprise,
		derivedState.isConnectedToGitLabEnterprise
	]);

	useEffect(() => {
		fetchPreconditionData();
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
		setFormState({ message: "", type: "" });
		setPreconditionError({ message: "", type: "" });
		try {
			const result = await HostApi.instance.send(CreatePullRequestRequestType, {
				reviewId: derivedState.reviewId!,
				providerId: prProviderId,
				title: prTitle,
				description: prText,
				baseRefName: prBranch,
				headRefName: currentBranch,
				remote: prRemote
			});
			if (result.error) {
				setFormState({ message: result.error.message || "", type: result.error.type || "UNKNOWN" });
			} else {
				setFormState({ message: "", type: "" });
				HostApi.instance.track("Pull Request Created", {
					Service: prProviderId
				});
				props.closePanel();
				dispatch(setCurrentReview(derivedState.reviewId!));
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
					// optimistically
					setPrBranch(_);
					HostApi.instance
						.send(CheckPullRequestBranchPreconditionsRequestType, {
							reviewId: derivedState.reviewId!,
							baseRefName: _,
							headRefName: currentBranch
						})
						.then((result: CheckPullRequestBranchPreconditionsResponse) => {
							setFormState({ message: "", type: "" });
							if (result && result.error) {
								setFormState({ message: result.error.message!, type: result.error.type! });
							} else {
								setFormState({ message: "", type: "" });
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

	const renderDisplayHost = host => {
		return host.startsWith("http://")
			? host.split("http://")[1]
			: host.startsWith("https://")
			? host.split("https://")[1]
			: host;
	};

	const renderProviders = () => {
		const { codeHostProviders, providers } = derivedState;
		let items = codeHostProviders.map(providerId => {
			const provider = providers[providerId];
			const { name, isEnterprise, host, needsConfigure, forEnterprise } = provider;
			const display = PROVIDER_MAPPINGS[name];
			if (!display) return null;

			const displayHost = renderDisplayHost(host);
			const displayName = isEnterprise
				? `${display.displayName} - ${displayHost}`
				: display.displayName;
			let action;
			if (needsConfigure) {
				// otherwise, if it's a provider that needs to be pre-configured,
				// bring up the custom popup for configuring it
				action = () =>
					dispatch(openPanel(`configure-provider-${name}-${providerId}-Integrations Panel`));
			} else if ((forEnterprise || isEnterprise) && name !== "jiraserver") {
				// otherwise if it's for an enterprise provider, configure for enterprise
				action = () => {
					dispatch(openPanel(`configure-enterprise-${name}-${providerId}-Integrations Panel`));
				};
			} else {
				// otherwise it's just a simple oauth redirect
				if (name === "github" || name === "bitbucket" || name === "gitlab") {
					action = () => {
						setPrProviderId(providerId);
						setPropsForPrePRProviderInfoModal({
							providerName: name,
							action: () => {
								dispatch(connectProvider(providerId, "Create Pull Request Panel"));
								setIsWaiting(true);
							},
							onClose: () => {
								setPropsForPrePRProviderInfoModal(undefined);
								setIsWaiting(true);
								setCurrentStep(2);
							}
						});
					};
				} else {
					action = () => {
						setPrProviderId(providerId);
						dispatch(connectProvider(providerId, "Create Pull Request Panel"));
						setIsWaiting(true);
						setCurrentStep(2);
					};
				}
			}

			return {
				label: displayName,
				key: providerId,
				action: action
			};
		});
		const filteredItems = items.filter(Boolean) as any;
		if (!filteredItems.length) return undefined;

		return (
			<span>
				<DropdownButton variant="text" items={filteredItems}>
					<strong>select service</strong>
				</DropdownButton>
			</span>
		);
	};

	const preconditionErrorMessages = () => {
		let messageText;
		if (preconditionError) {
			switch (preconditionError.type) {
				// TODO move these into en.js
				case "REPO_NOT_FOUND": {
					messageText = "Repo not found";
					break;
				}
				case "REPO_NOT_OPEN": {
					messageText = "Repo not currently open";
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
				case "ALREADY_HAS_PULL_REQUEST": {
					messageText = "There is already an open PR for this branch";
					break;
				}
				case "PROVIDER": {
					messageText = preconditionError.message || "Unknown provider error";
					break;
				}
				default: {
					messageText = preconditionError.message || "Unknown error";
				}
			}
		}
		return <div className="error-message form-error">{messageText}</div>;
	};

	const formErrorMessages = () => {
		if (!formState || !formState.type) return undefined;

		let messageText;
		if (formState.type) {
			switch (formState.type) {
				// TODO move these into en.js
				case "REPO_NOT_FOUND": {
					messageText = "Repo not found";
					break;
				}
				case "REPO_NOT_OPEN": {
					messageText = "Repo not currently open";
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
				case "ALREADY_HAS_PULL_REQUEST": {
					messageText = "There is already an open PR for this branch";
					break;
				}
				case "PROVIDER": {
					messageText = formState.message || "Unknown provider error";
					break;
				}
				default: {
					messageText = "Unknown error";
				}
			}
		}
		return <div className="error-message form-error">{messageText}</div>;
	};

	const onClickTryAgain = (event: React.SyntheticEvent) => {
		event.preventDefault();
		if (prProviderId) {
			setCurrentStep(1);
		}
	};

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

	const providerAuthenticationMessage = () => {
		let providerName = "Provider";
		if (prProviderId) {
			const provider = derivedState.providers[prProviderId];
			const { name } = provider;
			const display = PROVIDER_MAPPINGS[name];
			if (display) providerName = display.displayName;
		}

		return isWaiting ? (
			<strong>
				Waiting for {providerName} authentication <LoadingEllipsis />
			</strong>
		) : (
			<strong>
				Authentication timed out. Please <Link onClick={onClickTryAgain}>try again</Link>.
			</strong>
		);
	};

	if (propsForPrePRProviderInfoModal) {
		return <PrePRProviderInfoModal {...propsForPrePRProviderInfoModal} />;
	}

	return (
		<Root className="full-height-panel">
			<form className="standard-form vscroll">
				<div className="panel-header">
					<CancelButton onClick={props.closePanel} />
				</div>
				<fieldset className="form-body" style={{ width: "35em", padding: "20px 0" }}>
					<div className="outline-box">
						<h3>Open a Pull Request</h3>
						<div id="controls">
							{!loading && preconditionError.type && preconditionErrorMessages()}
							{!loading && formErrorMessages()}
							{loading && <LoadingMessage>Loading repo info...</LoadingMessage>}
							<Step1 step={currentStep}>
								<div>Open a pull request on {renderProviders()}</div>
							</Step1>
							<Step2 step={currentStep}>{providerAuthenticationMessage()}</Step2>
							<Step3 step={currentStep}>
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
								<div className="control-group">
									<div>
										<span>
											Compare <strong>{currentBranch}</strong> against{" "}
										</span>
										{renderBranchesDropdown()}
									</div>
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
										placeholder="Pull request description (optional)"
									/>
								</div>
								<ButtonRow>
									<Button onClick={onSubmit} isLoading={submitting}>
										Create Pull Request
									</Button>
								</ButtonRow>
							</Step3>
						</div>
					</div>
				</fieldset>
			</form>
		</Root>
	);
};
