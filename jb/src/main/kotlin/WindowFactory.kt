package com.codestream

import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory


class WindowFactory : ToolWindowFactory {


    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val webView = JxWebView()

        toolWindow.component.add(webView.component)
        Disposer.register(toolWindow.contentManager, webView)

        webView.addConsoleListener(WebViewRouter())

        val url = "file:///Users/mfarias/Code/jetbrains-codestream/src/main/resources/webview/webview.html"
        webView.loadURL(url) // TODO webview.load() + extract
    }

}