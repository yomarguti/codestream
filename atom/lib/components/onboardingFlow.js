import { Machine } from "xstate"
import onboardingFlow from "./onboardingFlow"

export default Machine({
	key: "onboarding",
	initial: "signUp",
	states: {
		signUp: {
			on: {
				success: "confirmEmail"
			}
		},
		confirmEmail: {
			on: {
				success: "signIn"
			},
			on: { back: "signUp" }
		},
		signIn: {
			on: {
				success: "chat"
			}
		}
	}
})
