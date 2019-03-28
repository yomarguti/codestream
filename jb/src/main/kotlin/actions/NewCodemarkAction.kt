package com.codestream.actions

import com.codestream.WebViewService
import com.codestream.editor.selectionOrCurrentLine
import com.codestream.editor.uri
import com.codestream.models.CodemarkType
import com.codestream.protocols.webview.CodemarkNotifications
import com.intellij.codeInsight.intention.IntentionAction
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.Iconable
import com.intellij.psi.PsiFile

abstract class NewCodemarkAction(val type: CodemarkType) : AnAction(), IntentionAction, Iconable {

    private fun execute(project : Project) {
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

    override fun actionPerformed(e: AnActionEvent) {
        e.project?.let { execute(it) }
    }

    override fun invoke(project: Project, editor: Editor?, file: PsiFile?) {
        execute(project)
    }

    override fun startInWriteAction() = true

    override fun getFamilyName() = "CodeStream"

    override fun isAvailable(project: Project, editor: Editor?, file: PsiFile?) = true

}

class AddCommentAction : NewCodemarkAction(CodemarkType.COMMENT) {
    override fun getText() = "Add comment"
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-comment.svg")
}

class CreateIssueAction : NewCodemarkAction(CodemarkType.ISSUE) {
    override fun getText() = "Create issue"
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-issue.svg")
}
class CreateBookmarkAction : NewCodemarkAction(CodemarkType.BOOKMARK) {
    override fun getText() = "Create bookmark"
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-bookmark.svg")
}
class GetPermalinkAction : NewCodemarkAction(CodemarkType.LINK) {
    override fun getText() = "Get permalink"
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-permalink.svg")
}
