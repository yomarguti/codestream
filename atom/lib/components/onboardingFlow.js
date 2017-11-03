import { Machine } from "xstate"
import onboardingFlow from "./onboardingFlow"

export default Machine({
	key: "onboarding",
	initial: "signUp",
	states: {
		signUp: {
			on: {
				success: "confirmEmail",
				emailExists: "login"
			}
		},
		confirmEmail: {
			on: {
				success: "login",
				back: "signUp"
			}
		},
		login: {
			on: {
				success: "chat",
				signUp: "signUp",
				forgotPassword: "resetPassword"
			}
		}
	}
})
