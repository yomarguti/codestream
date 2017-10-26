import CodestreamView from "./codestream-view"
import { CompositeDisposable } from "atom"

module.exports = {
	subscriptions: null,

	activate(state) {
		this.subscriptions = new CompositeDisposable()
		this.codestreamView = new CodestreamView(state.codestreamViewState)
		this.subscriptions.add(
			atom.workspace.addOpener(uri => {
				if (uri === "atom://codestream") {
					return new CodestreamView()
				}
			}),
			atom.commands.add("atom-workspace", {
				"codestream:toggle": () => atom.workspace.toggle("atom://codestream")
			})
		)
	},

	deactivate() {
		this.subscriptions.dispose()
	},

	serialize() {
		return {
			codestreamViewState: this.codestreamView.serialize()
		}
	}
}
