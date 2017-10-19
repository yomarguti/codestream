import CodestreamView from "./codestream-view"
import { CompositeDisposable } from "atom"

module.exports = {
  codestreamView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.subscriptions = new CompositeDisposable()
    this.codestreamView = new CodestreamView(state.codestreamViewState)
    this.subscriptions.add(
      atom.commands.add("atom-workspace", {
        "codestream:toggle": () => this.codestreamView.toggle()
      })
    )
  },

  deactivate() {
    this.modalPanel.destroy()
    this.subscriptions.dispose()
    this.codestreamView.destroy()
  },

  serialize() {
    return {
      codestreamViewState: this.codestreamView.serialize()
    }
  }
}
