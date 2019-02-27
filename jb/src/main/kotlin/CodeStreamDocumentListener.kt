package com.codestream

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.markup.GutterIconRenderer
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.text.StringUtil
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.eclipse.lsp4j.*
import javax.swing.Icon

class CodeStreamDocumentListener(
    private val editor: Editor,
    private val agentService: AgentService
) : DocumentListener {

    var updateMarkersJob: Job? = null

    init {
        renderMarkers(editor)
    }

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

        updateMarkersJob?.cancel()
        updateMarkersJob = GlobalScope.launch {
            delay(500L)
            renderMarkers(editor)
        }
    }

    private fun renderMarkers(editor: Editor) = GlobalScope.launch {
        val url = editorToURIString(editor) ?: return@launch
        val markers = try {
            agentService.documentMarkers(url).markers
        } catch (e: Exception) {
            return@launch
        }
        ApplicationManager.getApplication().invokeLater {
            editor.markupModel.removeAllHighlighters()
            for (marker in markers) {
                val start = LSPPosToOffset(editor, marker.range.start)
                val end = LSPPosToOffset(editor, marker.range.end)
                //                                val highlighter = editor.markupModel.addRangeHighlighter(start, end, HighlighterLayer.FIRST, null, HighlighterTargetArea.EXACT_RANGE)
                val highlighter = editor.markupModel.addRangeHighlighter(
                    start,
                    end,
                    HighlighterLayer.FIRST,
                    null,
                    HighlighterTargetArea.EXACT_RANGE
                )

                val renderer = object : GutterIconRenderer() {
                    override fun getTooltipText(): String? {
                        return marker.summary
                    }

                    override fun getIcon(): Icon {
                        return IconLoader.getIcon("/images/marker-${marker.codemark.type}-${marker.codemark.color}.svg")
                    }

                    override fun equals(other: Any?): Boolean {
                        return false
                    }

                    override fun hashCode(): Int {
                        return 0
                    }

                }

                highlighter.gutterIconRenderer = renderer
            }
        }
    }

}