package com.codestream.extensions

import com.intellij.openapi.editor.event.SelectionEvent
import org.eclipse.lsp4j.Range
import protocols.webview.EditorSelection

val SelectionEvent.editorSelections: List<EditorSelection>
    get() = newRanges.map {
        EditorSelection(
            editor.document.lspPosition(it.startOffset),
            editor.document.lspPosition(it.endOffset),
            editor.document.lspPosition(editor.caretModel.offset)
        )
    }

val SelectionEvent.lspRange: Range
    get() = Range(
        editor.document.lspPosition(newRange.startOffset),
        editor.document.lspPosition(newRange.endOffset)
    )