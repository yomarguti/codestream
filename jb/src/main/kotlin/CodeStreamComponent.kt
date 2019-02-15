package com.codestream

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.wm.ToolWindowAnchor
import com.intellij.openapi.wm.ToolWindowManager

interface CodeStreamComponent

class CodeStreamComponentImpl(project: Project) : CodeStreamComponent {

    init {
        val webViewService = ServiceManager.getService(project, WebViewService::class.java)
        ApplicationManager.getApplication().invokeLater {
            val toolWindowManager = ToolWindowManager.getInstance(project)
            val toolWindow = toolWindowManager.registerToolWindow(
                "CodeStream",
                false,
                ToolWindowAnchor.RIGHT,
                webViewService,
                true
            )
            toolWindow.icon = IconLoader.getIcon("/images/codestream.svg")
            toolWindow.component.add(webViewService.webView)
        }
    }
}