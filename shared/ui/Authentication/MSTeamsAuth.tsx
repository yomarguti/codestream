import React, { useState, useCallback } from "react";
import { Link } from "../Stream/Link";
import { connect } from "react-redux";
import { goToSignup } from "../store/context/actions";
import { useInterval, useRetryingCallback, useTimeout } from "../utilities/hooks";
import { validateSignup, startSSOSignin, SignupType } from "../store/actions";
import { DispatchProp } from "../store/common";
import { inMillis } from "../utils";

const noop = () => Promise.resolve();

interface Props extends DispatchProp {
	type?: SignupType;
}

export const MSTeamsAuth = (connect(undefined) as any)((props: Props) => {
	const [isWaiting, setIsWaiting] = useState(true);

	const stopWaiting = useCallback(() => {
		setIsWaiting(false);
	}, [isWaiting]);

	useTimeout(stopWaiting, inMillis(3, "min"));

	const onClickGoToSignup = (event: React.SyntheticEvent) => {
		event.preventDefault();
		props.dispatch(goToSignup());
	};

	const onClickTryAgain = (event: React.SyntheticEvent) => {
		event.preventDefault();
		props.dispatch(startSSOSignin("msteams", props.type ? { type: props.type } : undefined));
		setIsWaiting(true);
	};

	const validate = useCallback(async () => {
		try {
			await props.dispatch(
				validateSignup("MSTeams", props.type ? { type: props.type } : undefined)
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
					<h2>Microsoft Teams Authentication</h2>
					<p>
						Your web browser should have opened up to a Microsoft Teams authentication page. Once
						you've completed the authentication process, return here to get started with CodeStream.
					</p>
					<br />
					<div>
						<strong>
							{isWaiting ? (
								<p>
									Waiting for Microsoft Teams authentication <LoadingEllipsis />
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
						Don't want to use Microsoft Teams?{" "}
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
