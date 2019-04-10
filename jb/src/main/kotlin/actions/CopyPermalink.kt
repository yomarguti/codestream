package com.codestream.actions

import com.codestream.AgentService
import com.codestream.editor.selectionOrCurrentLine
import com.codestream.editor.uri
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.ide.CopyPasteManager
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import protocols.agent.CreatePermalinkParams
import protocols.agent.PermalinkPrivacy
import java.awt.datatransfer.StringSelection

private val PERMALINK_COPIED = Notification(
    "CodeStream",
    "CodeStream",
    "Permalink copied to clipboard",
    NotificationType.INFORMATION
)

class CopyPermalink : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val agentService = ServiceManager.getService(project, AgentService::class.java)

        val uri = editor.document.uri
        val selection = editor.selectionOrCurrentLine

        GlobalScope.launch {
            val result = agentService.createPermalink(
                CreatePermalinkParams(uri, selection, PermalinkPrivacy.PRIVATE.value)
            )

            CopyPasteManager.getInstance().setContents(StringSelection(result.linkUrl))
            Notifications.Bus.notify(PERMALINK_COPIED, project)
        }
    }

}