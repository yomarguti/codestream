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
			}
		},
		signIn: {
			on: {
				success: "chat"
			}
		}
	}
})
