package com.codestream

import com.codestream.editor.EditorFactoryListenerImpl
import com.codestream.editor.FileEditorManagerListenerImpl
import com.codestream.protocols.webview.FocusNotifications
import com.google.gson.Gson
import com.intellij.ProjectTopics
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowAnchor
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.WindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.util.ui.UIUtil
import java.awt.event.WindowEvent
import java.awt.event.WindowFocusListener
import kotlin.properties.Delegates


val gson = Gson()
val DEBUG =
    java.lang.management.ManagementFactory.getRuntimeMXBean().inputArguments.toString().contains("-agentlib:jdwp")

class CodeStreamComponent(val project: Project) : Disposable, ServiceConsumer(project) {

    companion object {
        fun getInstance(project: Project) = project.getComponent(CodeStreamComponent::class.java)
    }

    private lateinit var toolWindow: ToolWindow
    private var focused by Delegates.observable(true) { _, _, _ ->
        updateWebViewFocus()
    }

    init {
        ApplicationManager.getApplication().invokeLater {
            val toolWindowManager = ToolWindowManager.getInstance(project)
            toolWindow = toolWindowManager.registerToolWindow(
                "CodeStream",
                false,
                ToolWindowAnchor.RIGHT,
                webViewService,
                true
            )
            toolWindow.icon = IconLoader.getIcon("/images/codestream.svg")
            toolWindow.component.add(webViewService.webView)

            val frame = WindowManager.getInstance().getFrame(project)
            val window = UIUtil.getWindow(frame)
            window?.addWindowFocusListener(object : WindowFocusListener {
                override fun windowLostFocus(e: WindowEvent?) { focused = false }
                override fun windowGainedFocus(e: WindowEvent?) { focused = true }
            })

            EditorFactory.getInstance().addEditorFactoryListener(EditorFactoryListenerImpl(project), this)

            project.messageBus.connect().let {
                it.subscribe(
                    FileEditorManagerListener.FILE_EDITOR_MANAGER,
                    FileEditorManagerListenerImpl(project)
                )
                it.subscribe(
                    ProjectTopics.MODULES,
                    ModuleListenerImpl(project)
                )
                it.subscribe(
                    ToolWindowManagerListener.TOPIC,
                    object : ToolWindowManagerListener {
                        override fun stateChanged() { updateWebViewFocus() }
                    }
                )
            }

            val statusBar = WindowManager.getInstance().getIdeFrame(project).statusBar
    //        val statusBar = WindowManager.getInstance().getStatusBar(project)
            statusBar?.addWidget(CodeStreamStatusBarWidget(project))

            sessionService.onUnreadsChanged {
                ApplicationManager.getApplication().invokeLater {
                    toolWindow.icon = if (it > 0) {
                        IconLoader.getIcon("/images/marker-codestream.svg")
                    } else {
                        IconLoader.getIcon("/images/codestream.svg")
                    }
                }
            }
        }
    }

    fun toggleVisible() {
        when (toolWindow.isVisible) {
            true -> hide()
            false -> show()
        }
    }

    fun show() {
        toolWindow.show(null)
    }

    fun hide() {
        toolWindow.hide(null)
    }

    private fun updateWebViewFocus() {
        if (project.isDisposed) return

        val isFocused = focused && toolWindow.isVisible
        webViewService.postNotification(FocusNotifications.DidChange(isFocused))
    }

    override fun dispose() {
    }

}