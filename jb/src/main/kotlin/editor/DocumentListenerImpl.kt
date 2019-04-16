package com.codestream.editor

import com.codestream.editorService
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.project.Project
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class DocumentListenerImpl(val project: Project) : DocumentListener {
    var debounced: Job? = null

    override fun documentChanged(e: DocumentEvent) {
        debounced?.cancel()
        debounced = GlobalScope.launch {
            delay(300L)
            project.editorService?.updateMarkers(e.document)
        }
    }
}