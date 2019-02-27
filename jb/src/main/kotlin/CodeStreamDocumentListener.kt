package com.codestream

import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.util.text.StringUtil
import org.eclipse.lsp4j.*

class CodeStreamDocumentListener(
    private val editor: Editor,
    private val agentService: AgentService
) : DocumentListener {

    private val changesParams = DidChangeTextDocumentParams(
        VersionedTextDocumentIdentifier(editorToURIString(editor), 1),
        listOf(TextDocumentContentChangeEvent())
    )

    override fun documentChanged(event: DocumentEvent) {
        changesParams.textDocument.version++
        when (agentService.syncKind) {
            TextDocumentSyncKind.Incremental -> {
                val changeEvent = changesParams.contentChanges[0]
                val newText = event.newFragment
                val offset = event.offset
                val newTextLength = event.newLength
                val lspPosition: Position = offsetToLSPPos(editor, offset)
                val startLine = lspPosition.line
                val startColumn = lspPosition.character
                val oldText = event.oldFragment

                //if text was deleted/replaced, calculate the end position of inserted/deleted text
                val startPosition = Position(startLine, startColumn)
                val endPosition = if (oldText.isNotEmpty()) {
                    val line = startLine + StringUtil.countNewLines(oldText)
                    val oldLines = oldText.toString().split('\n')
                    val oldTextLength = if (oldLines.isEmpty()) 0 else oldLines.last().length
                    val column = if (oldLines.size == 1) startColumn + oldTextLength else oldTextLength
                    Position(line, column)
                } else {
                    startPosition //if insert or no text change, the end position is the same
                }
                val range = Range(startPosition, endPosition)
                changeEvent.range = range
                changeEvent.rangeLength = newTextLength
                changeEvent.text = newText.toString()
            }
            TextDocumentSyncKind.Full -> {
                changesParams.contentChanges[0].text = editor.document.text
            }
        }

        agentService.server.textDocumentService.didChange(changesParams)
    }

}