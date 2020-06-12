package com.codestream.actions

import com.codestream.codeStream
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class ToggleView : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.codeStream?.toggleVisible()
    }
}