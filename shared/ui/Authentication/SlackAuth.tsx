import React, { useState, useCallback } from "react";
import { Link } from "../Stream/Link";
import { connect } from "react-redux";
import { goToSignup } from "../store/context/actions";
import { useInterval, useRetryingCallback, useTimeout } from "../utilities/hooks";
import { validateSignup, startSlackSignin, SignupType } from "../store/actions";
import { DispatchProp } from "../store/common";

const noop = () => Promise.resolve();

interface Props extends DispatchProp {
	type?: SignupType;
}

export const SlackAuth = (connect(undefined) as any)((props: Props) => {
	const [isWaiting, setIsWaiting] = useState(true);

	const stopWaiting = useCallback(() => {
		setIsWaiting(false);
	}, [isWaiting]);

	useTimeout(stopWaiting, 60000 * 3); // 3 minutes

	const onClickGoToSignup = (event: React.SyntheticEvent) => {
		event.preventDefault();
		props.dispatch(goToSignup());
	};

	const onClickTryAgain = (event: React.SyntheticEvent) => {
		event.preventDefault();
		props.dispatch(startSlackSignin(props.type !== undefined ? { type: props.type } : undefined));
		setIsWaiting(true);
	};

	const validate = useCallback(async () => {
		try {
			await props.dispatch(
				validateSignup("Slack", props.type !== undefined ? { type: props.type } : undefined)
			);
		} catch (error) {
			setIsWaiting(false);
		}
	}, [props.type]);

	useRetryingCallback(isWaiting ? validate : noop);

	return (
		<div className="onboarding-page">
			<form className="standard-form">
				<fieldset className="form-body">
					<h2>Slack Authentication</h2>
					<p>
						Your web browser should have opened up to a Slack authentication page. Once you've
						completed the authentication process, return here to get started with CodeStream.
					</p>
					<br />
					<div>
						<strong>
							{isWaiting ? (
								<p>
									Waiting for Slack auth <LoadingEllipsis />
								</p>
							) : (
								<p>
									Login timed out. Please <Link onClick={onClickTryAgain}>try again</Link>
								</p>
							)}
						</strong>
					</div>
					<br />
					<p>
						Something went wrong? <Link href="mailto:support@codestream.com">Contact support</Link>{" "}
						or <Link onClick={onClickTryAgain}>Try again</Link>
					</p>
					<p>
						Don't want to use Slack?{" "}
						<Link onClick={onClickGoToSignup}>Sign up with CodeStream</Link> instead.
					</p>
				</fieldset>
			</form>
		</div>
	);
});

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
	});

	return <React.Fragment>{dots}</React.Fragment>;
}
