package com.codestream

import com.github.salomonbrys.kotson.jsonObject
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.event.SelectionEvent
import com.intellij.openapi.editor.event.SelectionListener
import com.intellij.openapi.editor.markup.GutterIconRenderer
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.util.text.StringUtil
import com.intellij.util.DocumentUtil
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import org.eclipse.lsp4j.*
import java.lang.IllegalArgumentException
import java.lang.IllegalStateException
import javax.swing.Icon

class EditorManagerService(val project: Project) {

    private val agentService: AgentService by lazy {
        ServiceManager.getService(project, AgentService::class.java)
    }

    private val webViewService: WebViewService by lazy {
        ServiceManager.getService(project, WebViewService::class.java)
    }

    private val managedDocuments = mutableMapOf<Document, DocumentVersion>()
    private val managedEditors = mutableSetOf<Editor>()

    fun add(editor: Editor) {
        managedEditors.add(editor)
        updateMarkers(editor)
        editor.selectionModel.addSelectionListener(PostCodeblockSynchronizer())

        val document = editor.document
        synchronized(managedDocuments) {
            if (!managedDocuments.contains(document)) {
                managedDocuments[document] = DocumentVersion()
                agentService.server.textDocumentService.didOpen(
                    DidOpenTextDocumentParams(document.textDocumentItem)
                )
                document.addDocumentListener(DocumentSynchronizer())
                document.addDocumentListener(MarkerUpdater())
            }
        }
    }

    fun remove(editor: Editor) {
        managedEditors.remove(editor)

        val document = editor.document
        synchronized(managedDocuments) {
            val editors = EditorFactory.getInstance().getEditors(document, project)
            if (editors.isEmpty()) {
                managedDocuments.remove(document)
                agentService.server.textDocumentService.didClose(
                    DidCloseTextDocumentParams(document.textDocumentIdentifier)
                )
            }
        }
    }

    fun updateMarkers() {
        for ((document, _) in managedDocuments) {
            updateMarkers(document)
        }
    }

    private fun updateMarkers(document: Document) {
        val uri = document.uri ?: return
        GlobalScope.launch {
            val result = agentService.documentMarkers(uri)
            val editors = EditorFactory.getInstance().getEditors(document, project)
            for (editor in editors) {
                // TODO check if editor is visible
                editor.renderMarkers(result.markers)
            }
        }

    }

    private fun updateMarkers(editor: Editor) {
        val uri = editor.document.uri ?: return
        GlobalScope.launch {
            val result = agentService.documentMarkers(uri)
            editor.renderMarkers(result.markers)
        }
    }

    private fun postCodeblock(document: Document, lspRange: Range) = GlobalScope.launch {
        val identifier = document.textDocumentIdentifier ?: return@launch
        val result = agentService.server.preparePostWithCode(PreparePostWithCodeParams(
            identifier, lspRange, true
        )).await()


        val file = if (result.source == null) {
            TODO("result.source == null")
        } else {
            result.source.file
        }

        webViewService.postMessage(jsonObject(
            "type" to "codestream:interaction:code-highlighted",
            "body" to gson.toJsonTree(mapOf(
                "code" to result.code,
                "file" to file,
                "fileUri" to document.uri,
                "range" to result.range,
                "source" to result.source,
                "gitError" to result.gitError,
                "isHighlight" to true

            ))
        ))
    }

    inner class DocumentSynchronizer : DocumentListener {
        override fun documentChanged(event: DocumentEvent) {
            when (agentService.syncKind) {
                TextDocumentSyncKind.Incremental -> {
                    val changesParams = DidChangeTextDocumentParams(
                        event.document.versionedTextDocumentIdentifier,
                        listOf(event.textDocumentContentChangeEvent)

                    )
                    agentService.server.textDocumentService.didChange(changesParams)
                }
                TextDocumentSyncKind.Full -> {
                    val change = TextDocumentContentChangeEvent(
                        null, null, event.document.text
                    )
                    val changesParams = DidChangeTextDocumentParams(
                        event.document.versionedTextDocumentIdentifier,
                        listOf(change)

                    )
                    agentService.server.textDocumentService.didChange(changesParams)
                }
                else -> throw IllegalArgumentException("Unsupported document synchronization kind")
            }
        }
    }

    inner class MarkerUpdater : DocumentListener {
        var debounced: Job? = null

        override fun documentChanged(e: DocumentEvent) {
            debounced?.cancel()
            debounced = GlobalScope.launch {
                delay(500L)
                updateMarkers(e.document)
            }
        }
    }

    inner class PostCodeblockSynchronizer : SelectionListener {
        var debounced: Job? = null

        override fun selectionChanged(e: SelectionEvent) {
            debounced?.cancel()
            debounced = GlobalScope.launch {
                delay(500L)
                postCodeblock(e.editor.document, e.lspRange)
            }
        }
    }

    class DocumentVersion {
        private var value = 1
        val nextValue: Int
            get() = value++
    }

    private val Document.uri: String?
        get() {
            val file = FileDocumentManager.getInstance().getFile(this) ?: return null
            return file.uri
        }

    private val Document.nextVersion: Int
        get() {
            val version = managedDocuments[this]
            return version?.nextValue ?: throw IllegalStateException("Cannot retrieve version of non-managed document")
        }

    private val Document.textDocumentItem: TextDocumentItem?
        get() = TextDocumentItem(uri, "", nextVersion, text)

    private val Document.textDocumentIdentifier: TextDocumentIdentifier?
        get() {
            return TextDocumentIdentifier(uri)
        }

    private val Document.versionedTextDocumentIdentifier: VersionedTextDocumentIdentifier
        get() {
            return VersionedTextDocumentIdentifier(uri, nextVersion)
        }

    private fun Document.lspPosition(offset: Int): Position {
        val line = getLineNumber(offset)
        val lineStart = getLineStartOffset(line)
        val lineTextBeforeOffset = getText(TextRange.create(lineStart, offset))
        val column = lineTextBeforeOffset.length
        return Position(line, column)
    }

    private val DocumentEvent.lspPosition: Position
        get() = document.lspPosition(offset)


    private val DocumentEvent.textDocumentContentChangeEvent: TextDocumentContentChangeEvent
        get() {
            // if text was deleted/replaced, calculate the end lspPosition of inserted/deleted text
            val position = this.lspPosition
            val startPosition = Position(position.line, position.character)
            val endPosition = if (oldFragment.isNotEmpty()) {
                val line = position.line + StringUtil.countNewLines(oldFragment)
                val oldLines = oldFragment.toString().split('\n')
                val oldTextLength = if (oldLines.isEmpty()) 0 else oldLines.last().length
                val column = if (oldLines.size == 1) position.character + oldTextLength else oldTextLength
                Position(line, column)
            } else {
                startPosition // if insert or no text change, the end lspPosition is the same
            }
            val range = Range(startPosition, endPosition)
            return TextDocumentContentChangeEvent(
                range, newLength, newFragment.toString()
            )
        }

    private val SelectionEvent.lspRange: Range
        get() = Range(
            editor.document.lspPosition(newRange.startOffset),
            editor.document.lspPosition(newRange.endOffset)
        )

    private fun Editor.renderMarkers(markers: List<DocumentMarker>) = ApplicationManager.getApplication().invokeLater {
        markupModel.removeAllHighlighters()
        for (marker in markers) {
            val start = getOffset(marker.range.start)
            val end = getOffset(marker.range.end)

            val highlighter = markupModel.addRangeHighlighter(
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

    fun Editor.getOffset(position: Position): Int {
        val line = position.line
        val lineText = document.getText(DocumentUtil.getLineTextRange(document, line))
        val lineTextForPosition = lineText.substring(0, Math.min(lineText.length, position.character))
        val tabs = StringUtil.countChars(lineTextForPosition, '\t')
        val tabSize = settings.getTabSize(project)
        val column = tabs * tabSize + lineTextForPosition.length - tabs
        val offset = logicalPositionToOffset(LogicalPosition(line, column))
        if (position.character >= lineText.length) {
//            println("LSPPOS outofbounds : $pos line : $lineText column : $column offset : $offset")
        }
        val docLength = document.textLength
        if (offset > docLength) {
            println("Offset greater than text length : $offset > $docLength")
        }
        return Math.min(Math.max(offset, 0), docLength)
    }

}

