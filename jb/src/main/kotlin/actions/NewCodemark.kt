package com.codestream.actions

import com.codestream.codeStream
import com.codestream.extensions.selectionOrCurrentLine
import com.codestream.extensions.uri
import com.codestream.models.CodemarkType
import com.codestream.protocols.webview.CodemarkNotifications
import com.codestream.webViewService
import com.intellij.codeInsight.intention.IntentionAction
import com.intellij.codeInsight.intention.LowPriorityAction
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.Iconable
import com.intellij.psi.PsiFile

abstract class NewCodemark(val type: CodemarkType) : AnAction(), IntentionAction, LowPriorityAction, Iconable {
    private fun execute(project: Project) {
        FileEditorManager.getInstance(project).selectedTextEditor?.run {
            project.codeStream?.show {
                project.webViewService?.postNotification(
                    CodemarkNotifications.New(
                        document.uri,
                        selectionOrCurrentLine,
                        type,
                        null
                    )
                )
            }
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

class AddComment : NewCodemark(CodemarkType.COMMENT) {
    override fun getText() = "Add comment"
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-comment.svg")
}

class CreateIssue : NewCodemark(CodemarkType.ISSUE) {
    override fun getText() = "Create issue"
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-issue.svg")
}

class CreateBookmark : NewCodemark(CodemarkType.BOOKMARK) {
    override fun getText() = "Create bookmark"
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-bookmark.svg")
}

class GetPermalink : NewCodemark(CodemarkType.LINK) {
    override fun getText() = "Get permalink"
    override fun getIcon(flags: Int) = IconLoader.getIcon("/images/marker-permalink.svg")
}
