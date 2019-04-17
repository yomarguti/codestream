package com.codestream

import com.codestream.agent.ModuleListenerImpl
import com.codestream.editor.EditorFactoryListenerImpl
import com.codestream.editor.FileEditorManagerListenerImpl
import com.codestream.protocols.webview.FocusNotifications
import com.codestream.widgets.CodeStreamStatusBarWidget
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

class CodeStreamComponent(val project: Project) : Disposable {

    private lateinit var toolWindow: ToolWindow
    private var focused by Delegates.observable(true) { _, _, _ ->
        updateWebViewFocus()
    }

    init {
        ApplicationManager.getApplication().invokeLater {
            val toolWindowManager = ToolWindowManager.getInstance(project) ?: return@invokeLater
            val webViewService = project.webViewService ?: return@invokeLater

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
                override fun windowLostFocus(e: WindowEvent?) {
                    focused = false
                }

                override fun windowGainedFocus(e: WindowEvent?) {
                    focused = true
                }
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
                        override fun stateChanged() {
                            updateWebViewFocus()
                        }
                    }
                )
            }

            val statusBar = WindowManager.getInstance().getIdeFrame(project).statusBar
            statusBar?.addWidget(CodeStreamStatusBarWidget(project))

            project.sessionService?.onUnreadsChanged {
                ApplicationManager.getApplication().invokeLater {
                    toolWindow.icon = if (it > 0) {
                        IconLoader.getIcon("/images/codestream-unread.svg")
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
        show(null)
    }

    fun show(afterShow: (() -> Unit)?) {
        toolWindow.show {
            project.webViewService?.webView?.grabFocus()
            afterShow?.invoke()
        }
    }

    fun hide() {
        toolWindow.hide(null)
    }

    private fun updateWebViewFocus() {
        if (project.isDisposed) return

        val isFocused = focused && toolWindow.isVisible
        project.webViewService?.postNotification(FocusNotifications.DidChange(isFocused))
    }

    override fun dispose() {
    }
}