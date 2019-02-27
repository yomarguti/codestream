package com.codestream

import com.google.gson.Gson
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.ex.EditorEx
import com.intellij.openapi.editor.markup.GutterIconRenderer
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.wm.ToolWindowAnchor
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.externalSystem.util.ExternalSystemApiUtil.subscribe
import com.intellij.openapi.fileEditor.*
import com.intellij.openapi.ui.popup.Balloon
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.util.text.StringUtil
import com.intellij.util.DocumentUtil
import com.sun.javafx.scene.CameraHelper.project
import com.intellij.util.messages.MessageBus
import kotlinx.coroutines.*
import org.eclipse.lsp4j.*
import org.jetbrains.annotations.NotNull
import java.util.concurrent.TimeUnit
import javax.swing.Icon


interface CodeStreamComponent

val gson
    get() = Gson()

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


        EditorFactory.getInstance().addEditorFactoryListener(EditorFactoryListenerImpl(project), Disposer.newDisposable())

        val messageBus = project.messageBus

        messageBus.connect()
            .subscribe(FileEditorManagerListener.FILE_EDITOR_MANAGER, CodeStreamFileEditorManagerListener(project))

    }

}