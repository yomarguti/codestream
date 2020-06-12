package com.codestream.actions

import com.codestream.webViewService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class ReloadWebview : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.webViewService?.load()
    }
}
