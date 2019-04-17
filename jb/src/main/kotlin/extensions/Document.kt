package com.codestream.extensions

import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.util.TextRange
import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.TextDocumentIdentifier

fun Document.lspPosition(offset: Int): Position {
    val line = getLineNumber(offset)
    val lineStart = getLineStartOffset(line)
    val lineTextBeforeOffset = getText(TextRange.create(lineStart, offset))
    val column = lineTextBeforeOffset.length
    return Position(line, column)
}

val Document.uri: String?
    get() {
        val file = FileDocumentManager.getInstance().getFile(this) ?: return null
        return file.uri
    }

val Document.path: String?
    get() {
        val file = FileDocumentManager.getInstance().getFile(this) ?: return null
        return file.path
    }

val Document.textDocumentIdentifier: TextDocumentIdentifier?
    get() = TextDocumentIdentifier(uri)