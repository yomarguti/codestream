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
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowAnchor
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.WindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.util.ui.UIUtil
import java.awt.event.WindowEvent
import java.awt.event.WindowFocusListener
import kotlin.properties.Delegates

const val CODESTREAM_TOOL_WINDOW_ID = "CodeStream"

class CodeStreamComponent(val project: Project) : Disposable {

    private lateinit var toolWindow: ToolWindow
    private var statusBar: StatusBar? = null
    private var statusBarWidget: CodeStreamStatusBarWidget? = null
    private var isFocused by Delegates.observable(true) { _, _, _ ->
        updateWebViewFocus()
    }
    var isVisible by Delegates.observable(false) { _, _, new ->
        _isVisibleObservers.forEach { it(new) }
    }

    init {
        ApplicationManager.getApplication().invokeLater {
            initToolWindow()
            initWindowFocusListener()
            initEditorFactoryListener()
            initMessageBusSubscriptions()
            initStatusBarWidget()
            initUnreadsListener()

            project.agentService?.onDidStart {
                val webViewService = project.webViewService ?: return@onDidStart
                webViewService.load()
                toolWindow.component.add(webViewService.webView)
            }
        }
    }

    private fun initToolWindow() {
        if (project.isDisposed) return
        val toolWindowManager = ToolWindowManager.getInstance(project) ?: return
        toolWindow = toolWindowManager.registerToolWindow(
            CODESTREAM_TOOL_WINDOW_ID,
            false,
            ToolWindowAnchor.RIGHT,
            this,
            true
        )
        toolWindow.icon = IconLoader.getIcon("/images/codestream.svg")
    }

    private fun initWindowFocusListener() {
        if (project.isDisposed) return
        val frame = WindowManager.getInstance().getFrame(project)
        val window = UIUtil.getWindow(frame)
        window?.addWindowFocusListener(object : WindowFocusListener {
            override fun windowLostFocus(e: WindowEvent?) {
                isFocused = false
            }

            override fun windowGainedFocus(e: WindowEvent?) {
                isFocused = true
            }
        })
    }

    private fun initEditorFactoryListener() {
        if (project.isDisposed) return
        EditorFactory.getInstance().addEditorFactoryListener(
            EditorFactoryListenerImpl(project), this
        )
    }

    private fun initMessageBusSubscriptions() {
        if (project.isDisposed) return
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
                        isVisible = toolWindow.isVisible
                        updateWebViewFocus()
                    }
                }
            )
        }
    }

    private fun initStatusBarWidget() {
        if (project.isDisposed) return
        val widget = CodeStreamStatusBarWidget(project)
        statusBar = WindowManager.getInstance().getIdeFrame(project).statusBar
        statusBar?.addWidget(widget)
        statusBarWidget = widget
    }

    private fun initUnreadsListener() {
        if (project.isDisposed) return
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

    fun toggleVisible() {
        when (isVisible) {
            true -> hide()
            false -> show()
        }
    }

    fun show(afterShow: (() -> Unit)?) {
        toolWindow.show {
            project.webViewService?.webView?.grabFocus()
            project.webViewService?.webView?.browser?.focus()
            afterShow?.invoke()
        }
    }

    private fun show() {
        show(null)
    }

    private fun hide() {
        toolWindow.hide(null)
    }

    private fun updateWebViewFocus() {
        project.webViewService?.postNotification(
            FocusNotifications.DidChange(isFocused && isVisible)
        )
    }

    override fun dispose() {
        val widget = statusBarWidget?.ID() ?: return
        statusBar?.removeWidget(widget)
    }

    private val _isVisibleObservers = mutableListOf<(Boolean) -> Unit>()
    fun onIsVisibleChanged(observer: (Boolean) -> Unit) {
        _isVisibleObservers += observer
    }
}
