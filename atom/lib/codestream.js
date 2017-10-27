import CodestreamView, { CODESTREAM_VIEW_URI } from "./codestream-view"
import { CompositeDisposable } from "atom"

module.exports = {
	subscriptions: null,

	activate(state) {
		this.subscriptions = new CompositeDisposable()
		this.subscriptions.add(
			atom.workspace.addOpener(uri => {
				if (uri === CODESTREAM_VIEW_URI) {
					return new CodestreamView()
				}
			}),
			atom.commands.add("atom-workspace", {
				"codestream:toggle": () => atom.workspace.toggle(CODESTREAM_VIEW_URI)
			})
		)
	},

	deactivate() {
		this.subscriptions.dispose()
	},

	serialize() {
		return {}
	},

	deserializeCodestreamView(serialized) {
		return new CodestreamView()
	}
}
