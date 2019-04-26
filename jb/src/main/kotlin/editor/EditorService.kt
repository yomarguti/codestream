package com.codestream.editor

import com.codestream.agentService
import com.codestream.codeStream
import com.codestream.extensions.getOffset
import com.codestream.extensions.isRangeVisible
import com.codestream.extensions.lspPosition
import com.codestream.extensions.margins
import com.codestream.extensions.path
import com.codestream.extensions.selections
import com.codestream.extensions.textAttributes
import com.codestream.extensions.textDocumentIdentifier
import com.codestream.extensions.uri
import com.codestream.extensions.visibleRanges
import com.codestream.protocols.webview.EditorNotifications
import com.codestream.sessionService
import com.codestream.settingsService
import com.codestream.webViewService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.SystemInfo
import com.intellij.openapi.util.text.StringUtil
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.util.ui.UIUtil
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import org.eclipse.lsp4j.DidChangeTextDocumentParams
import org.eclipse.lsp4j.DidCloseTextDocumentParams
import org.eclipse.lsp4j.DidOpenTextDocumentParams
import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range
import org.eclipse.lsp4j.TextDocumentContentChangeEvent
import org.eclipse.lsp4j.TextDocumentItem
import org.eclipse.lsp4j.TextDocumentSyncKind
import org.eclipse.lsp4j.VersionedTextDocumentIdentifier
import protocols.agent.DocumentMarker
import protocols.agent.DocumentMarkersParams
import protocols.agent.TextDocument
import protocols.webview.EditorContext
import protocols.webview.EditorInformation
import protocols.webview.EditorMetrics
import protocols.webview.EditorSelection
import protocols.webview.WebViewContext
import java.awt.HeadlessException
import java.awt.Toolkit
import java.io.File
import java.net.URI

class EditorService(val project: Project) {

    init {
        project.sessionService?.onUserLoggedInChanged { updateMarkers() }
        project.settingsService?.onWebViewContextChanged(this::onWebViewContextChanged)
        project.codeStream?.onIsVisibleChanged(this::onCodeStreamIsVisibleChanged)
    }

    private val logger = Logger.getInstance(EditorService::class.java)

    private val managedDocuments = mutableMapOf<Document, DocumentVersion>()
    private val managedEditors = mutableSetOf<Editor>()
    private val rangeHighlighters = mutableMapOf<Editor, MutableSet<RangeHighlighter>>()
    private val markerHighlighters = mutableMapOf<Editor, List<RangeHighlighter>>()
    private var spatialViewActive = project.settingsService?.webViewContext?.spatialViewVisible ?: false
    private var codeStreamVisible = project.codeStream?.isVisible ?: false



    fun add(editor: Editor) {
        managedEditors.add(editor)
        rangeHighlighters[editor] = mutableSetOf()
        updateMarkers(editor)
        editor.selectionModel.addSelectionListener(SelectionListenerImpl(project))
        editor.scrollingModel.addVisibleAreaListener(VisibleAreaListenerImpl(project))

        val document = editor.document
        synchronized(managedDocuments) {
            if (!managedDocuments.contains(document) && document.uri != null) {
                managedDocuments[document] = DocumentVersion()
                project.agentService?.agent?.textDocumentService?.didOpen(
                    DidOpenTextDocumentParams(document.textDocumentItem)
                )
                document.addDocumentListener(DocumentSynchronizer())
                document.addDocumentListener(DocumentListenerImpl(project))
            }
        }
    }

    fun remove(editor: Editor) {
        managedEditors.remove(editor)
        rangeHighlighters.remove(editor)

        val document = editor.document
        synchronized(managedDocuments) {
            val editors = EditorFactory.getInstance().getEditors(document, project)
            if (editors.isEmpty()) {
                managedDocuments.remove(document)
                project.agentService?.agent?.textDocumentService?.didClose(
                    DidCloseTextDocumentParams(document.textDocumentIdentifier)
                )
            }
        }
    }

    private val showMarkers: Boolean get() {
        val settings = project.settingsService ?: return false
        if (!settings.showMarkers) return false
        if (codeStreamVisible && spatialViewActive && settings.autoHideMarkers) return false
        return true
    }

    private fun onWebViewContextChanged(context: WebViewContext?) {
        context?.let {
            if (spatialViewActive != it.spatialViewVisible) {
                spatialViewActive = it.spatialViewVisible
                updateMarkers()
            }
        }
    }

    private fun onCodeStreamIsVisibleChanged(isVisible: Boolean) {
        if (isVisible != codeStreamVisible) {
            codeStreamVisible = isVisible
            updateMarkers()

            val editor = activeEditor
            if (isVisible && editor != null) {
                project.webViewService?.postNotification(
                    EditorNotifications.DidChangeVisibleRanges(
                        editor.document.uri,
                        editor.selections,
                        editor.visibleRanges,
                        editor.document.lineCount
                    )
                )
            }
        }
    }

    private fun updateMarkers() {
        for ((document, _) in managedDocuments) {
            updateMarkers(document)
        }
    }

    fun updateMarkers(uri: String) {
        val document = managedDocuments.keys.find { it.uri == uri }
        document?.let {
            updateMarkers(it)
        }
    }

    fun updateMarkers(document: Document) = GlobalScope.launch {
        val editors = EditorFactory.getInstance().getEditors(document, project)
        val markers = getDocumentMarkers(document.uri)
        for (editor in editors) {
            editor.renderMarkers(markers)
        }
    }

    private fun updateMarkers(editor: Editor) {
        GlobalScope.launch {
            editor.renderMarkers(getDocumentMarkers(editor.document.uri))
        }
    }

    private suspend fun getDocumentMarkers(uri: String?): List<DocumentMarker> {
        val agentService = project.agentService
        val sessionService = project.sessionService

        val markers = if (uri == null || agentService == null || sessionService?.userLoggedIn == null || !showMarkers) {
            emptyList()
        } else {
            val result = agentService.documentMarkers(DocumentMarkersParams(TextDocument(uri)))
            result.markers
        }

        return markers.filter {
            it.codemark.status != "closed" && it.codemark.pinned == true
        }
    }

    inner class DocumentSynchronizer : DocumentListener {
        override fun documentChanged(event: DocumentEvent) {
            val agentService = project.agentService ?: return
            if (!managedDocuments.contains(event.document)) return
            when (agentService.syncKind) {
                TextDocumentSyncKind.Incremental -> {
                    val changesParams = DidChangeTextDocumentParams(
                        event.document.versionedTextDocumentIdentifier,
                        listOf(event.textDocumentContentChangeEvent)

                    )
                    agentService.agent.textDocumentService.didChange(changesParams)
                }
                TextDocumentSyncKind.Full -> {
                    val change = TextDocumentContentChangeEvent(
                        null, null, event.document.text
                    )
                    val changesParams = DidChangeTextDocumentParams(
                        event.document.versionedTextDocumentIdentifier,
                        listOf(change)

                    )
                    agentService.agent.textDocumentService.didChange(changesParams)
                }
                else -> throw IllegalArgumentException("Unsupported document synchronization kind")
            }
        }
    }

    inner class DocumentVersion {
        private var value = 1
        val nextValue: Int
            get() = value++
    }

    private val Document.nextVersion: Int
        get() {
            val version = managedDocuments[this]
            return version?.nextValue ?: throw IllegalStateException("Cannot retrieve version of non-managed document")
        }

    private val Document.textDocumentItem: TextDocumentItem?
        get() = TextDocumentItem(uri, "", nextVersion, text)

    private val Document.versionedTextDocumentIdentifier: VersionedTextDocumentIdentifier
        get() {
            return VersionedTextDocumentIdentifier(uri, nextVersion)
        }

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

    private fun Editor.renderMarkers(markers: List<DocumentMarker>) = ApplicationManager.getApplication().invokeLater {
        if (isDisposed) return@invokeLater

        markerHighlighters[this]?.let { highlighters ->
            highlighters.forEach { highlighter ->
                markupModel.removeHighlighter(highlighter)
            }
        }

        if (showMarkers) {
            markerHighlighters[this] = markers.map {
                val start = getOffset(it.range.start)
                val end = getOffset(it.range.end)

                markupModel.addRangeHighlighter(
                    Math.min(start, end),
                    Math.max(start, end),
                    HighlighterLayer.FIRST,
                    null,
                    HighlighterTargetArea.EXACT_RANGE
                ).apply {
                    gutterIconRenderer = GutterIconRendererImpl(project, it)
                }
            }
        }
    }

    private var _activeEditor: Editor? = null
    var activeEditor: Editor?
        get() = _activeEditor
        set(editor) {
            _activeEditor = editor

            val editorInfo = editor?.run {
                EditorInformation(
                    document.path,
                    document.uri,
                    EditorMetrics(
                        Math.round(colorsScheme.editorFontSize / getFontScale()),
                        lineHeight,
                        margins
                    ),
                    selections,
                    visibleRanges,
                    document.lineCount
                )
            }
            val notification = EditorNotifications.DidChangeActive(editorInfo)
            project.webViewService?.postNotification(notification)
        }

    suspend fun getEditorContext(): EditorContext {
        val future = CompletableDeferred<EditorContext>()
        ApplicationManager.getApplication().invokeLater {
            val editor = FileEditorManager.getInstance(project).selectedTextEditor
            val context = if (editor != null) {
                val file = FileDocumentManager.getInstance().getFile(editor.document)
                EditorContext(
                    null,
                    file?.name,
                    null,
                    editor.visibleRanges,
                    editor.document.uri,
                    editor.selections,
                    EditorMetrics(
                        Math.round(editor.colorsScheme.editorFontSize / getFontScale()),
                        editor.lineHeight,
                        editor.margins
                    )
                )
            } else {
                EditorContext()
            }
            future.complete(context)
        }
        return future.await()
    }

    private val _textAttributes = mutableMapOf<Editor, TextAttributes>()
    private fun getTextAttributes(editor: Editor): TextAttributes = _textAttributes.getOrPut(editor) {
        editor.textAttributes
    }

    fun toggleRangeHighlight(range: Range, highlight: Boolean) = ApplicationManager.getApplication().invokeLater {
        val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return@invokeLater
        val highlighters =
            rangeHighlighters[editor] ?: throw IllegalStateException("Highlighters not initialized for editor $editor")

        if (!highlight) {
            synchronized(highlighters) {
                for (highlighter in highlighters) {
                    editor.markupModel.removeHighlighter(highlighter)
                }
                highlighters.clear()
            }
            return@invokeLater
        }

        synchronized(highlighters) {
            if (range.start.line >= editor.document.lineCount) {
                return@invokeLater
            }

            val highlighter =
                if (range.start.line == range.end.line && range.start.character == 0 && range.end.character > 1000) {
                    editor.markupModel.addLineHighlighter(
                        range.start.line, HighlighterLayer.LAST, getTextAttributes(editor)
                    )
                } else {
                    val start = editor.getOffset(range.start)
                    val end = editor.getOffset(range.end)

                    editor.markupModel.addRangeHighlighter(
                        Math.min(start, end),
                        Math.max(start, end),
                        HighlighterLayer.LAST,
                        getTextAttributes(editor),
                        HighlighterTargetArea.EXACT_RANGE
                    )
                }
            highlighters.add(highlighter)
        }
    }

    suspend fun reveal(uri: String, range: Range?, atTop: Boolean? = null): Boolean {
        val future = CompletableDeferred<Boolean>()
        ApplicationManager.getApplication().invokeLater {
            val editor = FileEditorManager.getInstance(project).selectedTextEditor
            editor?.let {
                if (it.document.uri == uri && (range == null || it.isRangeVisible(range))) {
                    future.complete(true)
                    return@invokeLater
                }
            }

            val line = range?.start?.line ?: 0
            val virtualFile = LocalFileSystem.getInstance().findFileByIoFile(File(URI(uri)))
            if (virtualFile == null) {
                future.complete(false)
                return@invokeLater
            }

            if (editor?.document?.uri == uri && range != null && atTop == true) {
                val logicalPosition = LogicalPosition(range.start.line, range.start.character)
                val point = editor.logicalPositionToXY(logicalPosition)
                editor.scrollingModel.scrollVertically(point.y)
            } else {
                val editorManager = FileEditorManager.getInstance(project)
                editorManager.openTextEditor(OpenFileDescriptor(project, virtualFile, line, 0), true)
            }

            future.complete(true)
        }
        return future.await()
    }

    suspend fun select(uri: String, selection: EditorSelection, preserveFocus: Boolean): Boolean {
        val future = CompletableDeferred<Boolean>()
        ApplicationManager.getApplication().invokeLater {
            var editor = FileEditorManager.getInstance(project).selectedTextEditor
            if (editor?.document?.uri != uri || !editor.isRangeVisible(selection)) {
                val virtualFile = LocalFileSystem.getInstance().findFileByIoFile(File(URI(uri)))
                if (virtualFile == null) {
                    future.complete(false)
                    return@invokeLater
                }

                val editorManager = FileEditorManager.getInstance(project)
                val line = selection.start.line
                editor = editorManager.openTextEditor(OpenFileDescriptor(project, virtualFile, line, 0), true)
            }

            if (editor == null) {
                future.complete(false)
                return@invokeLater
            }

            editor.apply {
                val start = getOffset(selection.start)
                val end = getOffset(selection.end)
                val caret = getOffset(selection.cursor)
                selectionModel.setSelection(start, end)
                caretModel.moveToOffset(caret)
                if (!preserveFocus) component.grabFocus()
            }

            future.complete(true)
        }
        return future.await()
    }

    var isScrollingFromWebView = false

    fun scroll(uri: String, position: Position, atTop: Boolean) = ApplicationManager.getApplication().invokeLater {
        var editor = FileEditorManager.getInstance(project).selectedTextEditor
        if (editor?.document?.uri != uri) {
            return@invokeLater
        }

        val logicalPosition = LogicalPosition(position.line, position.character)
        val point = editor.logicalPositionToXY(logicalPosition)

        isScrollingFromWebView = true
        editor.scrollingModel.runActionOnScrollingFinished {
            isScrollingFromWebView = false
        }
        // logger.info("Scrolling to ${position.line} - atTop: $atTop")
        editor.scrollingModel.scrollVertically(point.y)
    }

    // var count = 0
    // fun toggleRangeHighlight2(range: Range, highlight: Boolean) = ApplicationManager.getApplication().invokeLater {
    //     val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return@invokeLater
    //     val highlighters =
    //         rangeHighlighters[editor] ?: throw IllegalStateException("No highlighters found for editor $editor")
    //
    //     if (!highlight) {
    //         synchronized(highlighters) {
    //             println("remove ${range.arrayString}")
    //             println(--count)
    //             val highlighter = highlighters[range]
    //                 ?: throw IllegalStateException("No highlighter found for range $range")
    //             editor.markupModel.removeHighlighter(highlighter)
    //             highlighters.remove(range)
    //         }
    //         return@invokeLater
    //     }
    //
    //     val textAttributes = TextAttributes(
    //         null, //editor.colorsScheme.getColor(EditorColors.CARET_ROW_COLOR),
    //         editor.colorsScheme.getColor(EditorColors.CARET_ROW_COLOR),
    //         null, //editor.colorsScheme.getColor(EditorColors.CARET_ROW_COLOR),
    //         null, //EffectType.BOXED,
    //         Font.PLAIN
    //     )
    //
    //     synchronized(highlighters) {
    //         println("add ${range.arrayString}")
    //         println(++count)
    //         val highlighter = if (range.start == range.end && range.start.character == 0) {
    //             editor.markupModel.addLineHighlighter(
    //                 range.start.line, HighlighterLayer.LAST, textAttributes
    //             )
    //         } else {
    //             editor.markupModel.addRangeHighlighter(
    //                 editor.getOffset(range.start),
    //                 editor.getOffset(range.end),
    //                 HighlighterLayer.LAST,
    //                 textAttributes,
    //                 HighlighterTargetArea.EXACT_RANGE
    //             )
    //         }
    //         highlighters[range] = highlighter
    //     }
    // }
}

fun getFontScale(): Float {
    if (UIUtil.isJreHiDPIEnabled() || SystemInfo.isMac) {
        return 1F
    }

    val dpi = try {
        Toolkit.getDefaultToolkit().screenResolution
    } catch (ignored: HeadlessException) {
        96
    }
    return discreteScale((dpi.toFloat() / 96))
}

fun discreteScale(scale: Float): Float {
    return Math.round(scale / .25F) * .25F
}


