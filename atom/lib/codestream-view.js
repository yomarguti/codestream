import React, { Component } from "react"
import { render, unmountComponentAtNode } from "react-dom"

class CodestreamView {
  constructor(serializedState) {
    this.isVisible = false
    this.element = document.createElement("div")
    render(<p>Hello from Codestream</p>, this.element)
  }

  getTitle() {
    return "Codestream"
  }

  getDefaultLocation() {
    return "right"
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    unmountComponentAtNode(this.element)
    this.element.remove()
  }

  toggle() {
    this.isVisible ? this.hide() : this.show()
  }

  hide() {
    atom.workspace.hide(this)
    this.isVisible = false
  }

  show() {
    if (!this.isVisible) {
      atom.workspace.open(this).then(() => {
        this.isVisible = true
        atom.workspace.getRightDock().show()
      })
    }
  }
}
module.exports = CodestreamView
