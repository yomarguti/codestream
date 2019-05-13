package com.codestream.editor

import com.codestream.extensions.editorSelections
import com.codestream.extensions.uri
import com.codestream.extensions.visibleRanges
import com.codestream.protocols.webview.EditorNotifications
import com.codestream.webViewService
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.event.SelectionEvent
import com.intellij.openapi.editor.event.SelectionListener
import com.intellij.openapi.project.Project

class SelectionListenerImpl(val project: Project) : SelectionListener {
    private val logger = Logger.getInstance(SelectionListenerImpl::class.java)

    override fun selectionChanged(e: SelectionEvent) {
        try {
            project.webViewService?.postNotification(
                EditorNotifications.DidChangeSelection(
                    e.editor.document.uri,
                    e.editorSelections,
                    e.editor.visibleRanges,
                    e.editor.document.lineCount
                )
            )
        } catch (e: Exception) {
            logger.warn(e)
        }
    }
}
