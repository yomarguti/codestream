package com.codestream

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.WindowManager
import com.intellij.util.Consumer
import java.awt.Component
import java.awt.event.MouseEvent

class CodeStreamStatusBarWidget(val project: Project) : StatusBarWidget, StatusBarWidget.TextPresentation,
    ServiceConsumer(project) {

    init {
        sessionService.onUserLoggedInChanged {
            val statusBar = WindowManager.getInstance().getIdeFrame(null).statusBar
            statusBar?.updateWidget(ID())
        }
    }

    override fun ID() = "CodeStream.StatusBar"

    override fun getPresentation(type: StatusBarWidget.PlatformType) = this

    override fun install(statusBar: StatusBar) = Unit

    override fun dispose() = Unit

    override fun getTooltipText() = "Click to open CodeStream"

    override fun getClickConsumer() = Consumer<MouseEvent> {
        ToolWindowManager.getInstance(project).getToolWindow("CodeStream").show(null)
    }

    override fun getText(): String {
        val userLoggedIn = sessionService.userLoggedIn ?: return "Sign in..."
        return userLoggedIn.user.username + " - " + userLoggedIn.team.name
    }

    override fun getAlignment(): Float {
        return Component.RIGHT_ALIGNMENT
    }

}
