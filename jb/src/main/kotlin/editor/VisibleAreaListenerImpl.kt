package com.codestream.editor

import com.codestream.editorService
import com.codestream.extensions.selections
import com.codestream.extensions.uri
import com.codestream.extensions.visibleRanges
import com.codestream.protocols.webview.EditorNotifications
import com.codestream.webViewService
import com.intellij.openapi.editor.event.VisibleAreaEvent
import com.intellij.openapi.editor.event.VisibleAreaListener
import com.intellij.openapi.project.Project

class VisibleAreaListenerImpl(val project: Project) : VisibleAreaListener {
    override fun visibleAreaChanged(e: VisibleAreaEvent) {
        val editorService = project.editorService ?: return
        if (editorService.isScrollingFromWebView || e.editor != editorService.activeEditor) return

        project.webViewService?.postNotification(
            EditorNotifications.DidChangeVisibleRanges(
                e.editor.document.uri,
                e.editor.selections,
                e.editor.visibleRanges,
                e.editor.document.lineCount
            )
        )
    }
}