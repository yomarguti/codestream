package com.codestream.actions

import com.codestream.agentService
import com.codestream.authenticationService
import com.codestream.webViewService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch

class SignOut : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        GlobalScope.launch {
            e.project?.let {
                it.authenticationService?.logout()
                it.agentService?.onDidStart {
                    it.webViewService?.load()
                }
            }
        }
    }
}
