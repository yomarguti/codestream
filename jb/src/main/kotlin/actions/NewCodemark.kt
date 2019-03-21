package com.codestream.actions

import com.codestream.WebViewService
import com.codestream.editor.selectionOrCurrentLine
import com.codestream.editor.uri
import com.codestream.models.CodemarkType
import com.codestream.protocols.webview.CodemarkNotifications
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.fileEditor.FileEditorManager

abstract class NewCodemark(val type: CodemarkType) : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        FileEditorManager.getInstance(project).selectedTextEditor?.run {
            val webViewService = ServiceManager.getService(project, WebViewService::class.java)
            webViewService.postNotification(CodemarkNotifications.New(
                document.uri,
                selectionOrCurrentLine,
                type,
                null
            ))
            webViewService.webView.grabFocus()
        }
    }

}

class AddComment : NewCodemark(CodemarkType.COMMENT)
class CreateIssue : NewCodemark(CodemarkType.ISSUE)
class CreateBookmark : NewCodemark(CodemarkType.BOOKMARK)
class GetPermalink : NewCodemark(CodemarkType.LINK)
