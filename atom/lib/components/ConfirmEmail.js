import React from "react"

export default function(props) {
	return (
		<div id="email-confirmation">
			<h2>You're almost there!</h2>
			<p>Please check your email. We've sent you a 6-digit code to confirm your email address.</p>
			<p>
				Didn't receive it? Check your spam folder, or have us <a>send another email</a>.
			</p>
			<p>
				<strong>{props.email}</strong> not correct? <a>Change it</a>.
			</p>
			<div>
				<div id="inputs">
					<input
						className="native-key-bindings input-text control"
						type="text"
						maxLength="1"
						tabIndex="0"
					/>
					<input
						className="native-key-bindings input-text control"
						type="text"
						maxLength="1"
						tabIndex="1"
					/>
					<input
						className="native-key-bindings input-text control"
						type="text"
						maxLength="1"
						tabIndex="2"
					/>
					<input
						className="native-key-bindings input-text control"
						type="text"
						maxLength="1"
						tabIndex="3"
					/>
					<input
						className="native-key-bindings input-text control"
						type="text"
						maxLength="1"
						tabIndex="4"
					/>
					<input
						className="native-key-bindings input-text control"
						type="text"
						maxLength="1"
						tabIndex="5"
					/>
				</div>
				<button id="submit-button" className="btn inline-block-tight btn-primary">
					SUBMIT
				</button>
			</div>
		</div>
	)
}
