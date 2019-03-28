package com.codestream

import com.codestream.editor.EditorFactoryListenerImpl
import com.codestream.editor.FileEditorManagerListenerImpl
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


val gson = Gson()
val DEBUG =
    java.lang.management.ManagementFactory.getRuntimeMXBean().inputArguments.toString().contains("-agentlib:jdwp")

class CodeStreamComponent(project: Project) : Disposable, ServiceConsumer(project) {

    private lateinit var toolWindow: ToolWindow

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
        }

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
        }

        val statusBar = WindowManager.getInstance().getIdeFrame(null).statusBar
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

    override fun dispose() {
    }

}