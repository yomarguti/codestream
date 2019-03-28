package com.codestream.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.wm.ToolWindowManager

class ToggleView : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.let {
            val toolWindow = ToolWindowManager.getInstance(it).getToolWindow("CodeStream")

            if (toolWindow.isVisible) toolWindow.hide(null)
            else {
                toolWindow.show { toolWindow.component.grabFocus() }

            }
        }
    }
}