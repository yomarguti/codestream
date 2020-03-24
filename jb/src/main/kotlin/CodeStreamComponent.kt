package com.codestream

import com.codestream.agent.ModuleListenerImpl
import com.codestream.editor.EditorFactoryListenerImpl
import com.codestream.editor.FileEditorManagerListenerImpl
import com.codestream.protocols.webview.FocusNotifications
import com.codestream.workaround.ToolWindowManagerWorkaround
import com.intellij.ProjectTopics
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.WindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.util.ui.UIUtil
import java.awt.event.WindowEvent
import java.awt.event.WindowFocusListener
import java.io.IOException
import java.net.URL
import java.net.URLConnection
import java.net.URLStreamHandler
import javax.swing.JLabel
import kotlin.properties.Delegates

const val CODESTREAM_TOOL_WINDOW_ID = "CodeStream"

class CodeStreamComponent(val project: Project) : Disposable {

    private val logger = Logger.getInstance(CodeStreamComponent::class.java)
    private val toolWindow: ToolWindow?
        get() = ToolWindowManagerWorkaround.getInstance(project)?.getToolWindow(CODESTREAM_TOOL_WINDOW_ID)

    var isFocused by Delegates.observable(true) { _, _, _ ->
        updateWebViewFocus()
    }
    var isVisible by Delegates.observable(false) { _, _, new ->
        _isVisibleObservers.forEach { it(new) }
    }

    init {
        logger.info("Initializing CodeStream")
        initUrlHandler()
        initEditorFactoryListener()
        initMessageBusSubscriptions()
        ApplicationManager.getApplication().invokeLater {
            initWindowFocusListener()
            initUnreadsListener()
        }
    }

    private fun initUrlHandler() {
        // CS review diffs use codestream-diff schema. This registration
        // is necessary otherwise URL constructor will throw an exception.
        URL.setURLStreamHandlerFactory { protocol ->
            if ("codestream-diff" == protocol) object : URLStreamHandler() {
                @Throws(IOException::class)
                override fun openConnection(url: URL?): URLConnection? {
                    return object : URLConnection(url) {
                        @Throws(IOException::class)
                        override fun connect() {
                            println("Connected!")
                        }
                    }
                }
            } else null
        }
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
                    override fun toolWindowRegistered(id: String) {
                        if (id != CODESTREAM_TOOL_WINDOW_ID) return
                        val loadingLabel = JLabel("Loading...", IconLoader.getIcon("/images/codestream.svg"), JLabel.CENTER)
                        toolWindow!!.component.add(loadingLabel)
                        project.agentService?.onDidStart {
                            val webViewService = project.webViewService ?: return@onDidStart
                            webViewService.load()
                            toolWindow?.component?.let { cmp ->
                                cmp.remove(loadingLabel)
                                cmp.add(webViewService.webView)
                            }
                        }
                    }

                    override fun stateChanged() {
                        isVisible = toolWindow?.isVisible ?: false
                        updateWebViewFocus()
                    }
                }
            )
        }
    }

    private fun initUnreadsListener() {
        if (project.isDisposed) return
        project.sessionService?.onUnreadsChanged {
            ApplicationManager.getApplication().invokeLater {
                toolWindow?.setIcon(if (it > 0) {
                    IconLoader.getIcon("/images/codestream-unread.svg")
                } else {
                    IconLoader.getIcon("/images/codestream.svg")
                })
            }
        }
    }

    fun toggleVisible() {
        when (isVisible) {
            true -> hide()
            false -> show()
        }
    }

    fun show(afterShow: (() -> Unit)? = null) {
        toolWindow?.show {
            project.webViewService?.webView?.grabFocus()
            afterShow?.invoke()
        }
    }

    private fun show() {
        show(null)
    }

    private fun hide() {
        toolWindow?.hide(null)
    }

    private fun updateWebViewFocus() {
        project.webViewService?.postNotification(
            FocusNotifications.DidChange(isFocused && isVisible)
        )
    }

    override fun dispose() {
    }

    private val _isVisibleObservers = mutableListOf<(Boolean) -> Unit>()
    fun onIsVisibleChanged(observer: (Boolean) -> Unit) {
        _isVisibleObservers += observer
    }
}
