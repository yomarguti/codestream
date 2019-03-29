package com.codestream.editor

import com.codestream.CodeStreamComponent
import com.codestream.ServiceConsumer
import com.codestream.TextDocument
import com.codestream.protocols.webview.EditorNotifications
import com.codestream.protocols.webview.StreamNotifications
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.LogicalPosition
import com.intellij.openapi.editor.colors.EditorColors
import com.intellij.openapi.editor.event.*
import com.intellij.openapi.editor.markup.*
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.util.text.StringUtil
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.util.DocumentUtil
import kotlinx.coroutines.*
import org.eclipse.lsp4j.*
import protocols.agent.DocumentMarker
import protocols.agent.DocumentMarkersParams
import protocols.webview.EditorContext
import protocols.webview.EditorMargins
import protocols.webview.EditorMetrics
import protocols.webview.EditorSelection
import java.awt.Font
import java.awt.Point
import java.io.File
import java.net.URI
import javax.swing.Icon

class EditorService(val project: Project) : ServiceConsumer(project) {

    init {
        sessionService.onUserLoggedInChanged { updateMarkers() }
    }

    private val managedDocuments = mutableMapOf<Document, DocumentVersion>()
    private val managedEditors = mutableSetOf<Editor>()
    private val rangeHighlighters = mutableMapOf<Editor, MutableSet<RangeHighlighter>>()
    private val markerHighlighters = mutableMapOf<Editor, List<RangeHighlighter>>()
    private var showMarkers = settingsService.showMarkers

    fun add(editor: Editor) {
        managedEditors.add(editor)
        rangeHighlighters[editor] = mutableSetOf()
        updateMarkers(editor)
        editor.selectionModel.addSelectionListener(EditorManagerSelectionListener())
        editor.scrollingModel.addVisibleAreaListener(EditorManagerVisibleAreaListener())

        val document = editor.document
        synchronized(managedDocuments) {
            if (!managedDocuments.contains(document)) {
                managedDocuments[document] = DocumentVersion()
                agentService.agent.textDocumentService.didOpen(
                    DidOpenTextDocumentParams(document.textDocumentItem)
                )
                document.addDocumentListener(DocumentSynchronizer())
                document.addDocumentListener(MarkerUpdater())
            }
        }
    }

    fun disableMarkers() = ApplicationManager.getApplication().invokeLater {
        showMarkers = false
        markerHighlighters.forEach { editor, hs ->
            hs.forEach { h ->
                h.dispose()
                editor.markupModel.removeHighlighter(h)
            }
        }
        markerHighlighters.clear()
    }

    fun enableMarkers() {
        showMarkers = true
        updateMarkers()
    }

    fun remove(editor: Editor) {
        managedEditors.remove(editor)
        rangeHighlighters.remove(editor)

        val document = editor.document
        synchronized(managedDocuments) {
            val editors = EditorFactory.getInstance().getEditors(document, project)
            if (editors.isEmpty()) {
                managedDocuments.remove(document)
                agentService.agent.textDocumentService.didClose(
                    DidCloseTextDocumentParams(document.textDocumentIdentifier)
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

    private fun updateMarkers(document: Document) = GlobalScope.launch {
        val editors = EditorFactory.getInstance().getEditors(document, project)

        val markers = if (sessionService.userLoggedIn == null || !showMarkers) {
            emptyList()
        } else {
            val uri = document.uri ?: return@launch
            val result = agentService.documentMarkers(DocumentMarkersParams(TextDocument(uri)))//.await()
            result.markers
        }

        for (editor in editors) {
            editor.renderMarkers(markers)
        }
    }

    private fun updateMarkers(editor: Editor) {
        if (sessionService.userLoggedIn == null || !showMarkers) {
            return
        }
        val uri = editor.document.uri ?: return
        GlobalScope.launch {
            val result = agentService.documentMarkers(DocumentMarkersParams(TextDocument(uri)))//.await()
            editor.renderMarkers(result.markers)
        }
    }

//    private fun postCodeblock(document: Document, lspRange: Range) = GlobalScope.launch {
//        if (sessionService.userLoggedIn == null) {
//            return@launch
//        }
//
//        val identifier = document.textDocumentIdentifier ?: return@launch
//        val result = agentService.agent.preparePostWithCode(
//            PreparePostWithCodeParams(
//                identifier, lspRange, true
//            )
//        ).await()
//
//
//        val file = if (result.source == null) {
//            TODO("result.source == null")
//        } else {
//            result.source.file
//        }
//
//        webViewService.postMessage(
//            jsonObject(
//                "type" to "codestream:interaction:code-highlighted",
//                "body" to gson.toJsonTree(
//                    mapOf(
//                        "code" to result.code,
//                        "file" to file,
//                        "fileUri" to document.uri,
//                        "range" to result.range,
//                        "source" to result.source,
//                        "gitError" to result.gitError,
//                        "isHighlight" to true
//
//                    )
//                )
//            )
//        )
//    }

    inner class DocumentSynchronizer : DocumentListener {
        override fun documentChanged(event: DocumentEvent) {
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

    inner class MarkerUpdater : DocumentListener {
        var debounced: Job? = null

        override fun documentChanged(e: DocumentEvent) {
            debounced?.cancel()
            debounced = GlobalScope.launch {
                delay(300L)
                updateMarkers(e.document)
            }
        }
    }

    inner class EditorManagerSelectionListener : SelectionListener {
//        var debounced: Job? = null

        override fun selectionChanged(e: SelectionEvent) {
//            debounced?.cancel()
//            debounced = GlobalScope.launch {
//                delay(100L)
//                ApplicationManager.getApplication().invokeLater {
            webViewService.postNotification(
                EditorNotifications.DidChangeSelection(
                    e.editor.document.uri,
                    e.editorSelections,
                    e.editor.visibleRanges,
                    e.editor.document.lineCount
                )
            )
//                }
//            }
        }
    }

    inner class EditorManagerVisibleAreaListener : VisibleAreaListener {
        override fun visibleAreaChanged(e: VisibleAreaEvent) {
            webViewService.postNotification(
                EditorNotifications.DidChangeVisibleRanges(
                    e.editor.document.uri,
                    e.editor.selections,
                    e.editor.visibleRanges,
                    e.editor.document.lineCount
                )
            )
        }
    }

    class DocumentVersion {
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

    private val Document.textDocumentIdentifier: TextDocumentIdentifier?
        get() {
            return TextDocumentIdentifier(uri)
        }

    private val Document.versionedTextDocumentIdentifier: VersionedTextDocumentIdentifier
        get() {
            return VersionedTextDocumentIdentifier(uri, nextVersion)
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

    private val SelectionEvent.editorSelections: List<EditorSelection>
        get() = newRanges.map {
            EditorSelection(
                editor.document.lspPosition(it.startOffset),
                editor.document.lspPosition(it.endOffset),
                editor.document.lspPosition(editor.caretModel.offset)
            )
        }

    private val SelectionEvent.lspRange: Range
        get() = Range(
            editor.document.lspPosition(newRange.startOffset),
            editor.document.lspPosition(newRange.endOffset)
        )

    private fun Editor.renderMarkers(markers: List<DocumentMarker>) = ApplicationManager.getApplication().invokeLater {
        if (isDisposed) return@invokeLater

        if (showMarkers) {
            markerHighlighters[this]?.let { highlighters ->
                highlighters.forEach { highlighter ->
                    markupModel.removeHighlighter(highlighter)
                }
            }
            markerHighlighters[this] = markers.map {
                val start = getOffset(it.range.start)
                val end = getOffset(it.range.end)

                markupModel.addRangeHighlighter(
                    start,
                    end,
                    HighlighterLayer.FIRST,
                    null,
                    HighlighterTargetArea.EXACT_RANGE
                ).apply {
                    gutterIconRenderer = MarkerGutterIconRenderer(it)
                }
            }
        }
    }

    inner class MarkerGutterIconRenderer(private val marker: DocumentMarker) : GutterIconRenderer() {
        val id: String
            get() = marker.codemark.id

        override fun isNavigateAction(): Boolean {
            return true
        }

        override fun getClickAction(): AnAction? {
            return object : AnAction() {
                override fun actionPerformed(e: AnActionEvent) {
                    CodeStreamComponent.getInstance(project).show()
                    webViewService.postNotification(
                        StreamNotifications.Show(
                            marker.codemark.streamId,
                            marker.codemark.postId
                        )
                    )
                }

            }
        }

        override fun getTooltipText(): String? {
            return marker.summary
        }

        override fun getIcon(): Icon {
            return IconLoader.getIcon(
                "/images/marker-${marker.codemark.type ?: "comment"}-${marker.codemark.color ?: "blue"}.svg"
            )
        }


        override fun equals(other: Any?): Boolean {
            val otherRenderer = other as? MarkerGutterIconRenderer ?: return false
            return id == otherRenderer.id
        }

        override fun hashCode(): Int {
            return id.hashCode()
        }
    }

    fun Editor.getOffset(position: Position): Int {
        val line = position.line
        val lineText = document.getText(DocumentUtil.getLineTextRange(document, line))
        val endIndex = Math.min(lineText.length, position.character)
        val lineTextForPosition = lineText.substring(0, endIndex)
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

    private val Editor.margins: EditorMargins
        get() {
            return EditorMargins(0, 0, 0, 0)

            val visibleArea = scrollingModel.visibleArea

            val viewportStartPoint = visibleArea.location
            val startLogicalPos = xyToLogicalPosition(viewportStartPoint)
            val startActualPoint = logicalPositionToXY(startLogicalPos)
            val marginTop = startActualPoint.y - visibleArea.y

            val viewportEndPoint = Point(
                visibleArea.location.x + visibleArea.width,
                visibleArea.location.y + visibleArea.height
            )
            val endLogicalPos = xyToLogicalPosition(viewportEndPoint)
            val endActualPoint = logicalPositionToXY(endLogicalPos).let {
                Point(it.x, it.y + lineHeight)
            }

            val marginBottom = viewportEndPoint.y - endActualPoint.y

//            println("\n-------")
//            println("Viewport start y: ${viewportStartPoint.y}")
//            println("First line top y: ${startActualPoint.y}")
//            println("Margin top: $marginTop")
//            println("Viewport end y: ${viewportEndPoint.y}")
//            println("Last line bottom y: ${endActualPoint.y}")
//            println("Margin bottom: $marginBottom")
//            println("-------\n")


            return EditorMargins(
                marginTop, 0, marginBottom, 0
            )
        }

    private val Editor.selections: List<EditorSelection>
        get() {
            return listOf(
                EditorSelection(
                    document.lspPosition(selectionModel.selectionStart),
                    document.lspPosition(selectionModel.selectionEnd),
                    document.lspPosition(caretModel.offset)
                )
            )
        }

    fun setActiveEditor(newEditor: FileEditor?) {
        FileEditorManager.getInstance(project).selectedTextEditor?.run {
            val notification = EditorNotifications.DidChangeActive(
                newEditor?.file?.path,
                document.uri,
                EditorMetrics(
                    colorsScheme.editorFontSize,
                    lineHeight,
                    margins
                ),
                selections,
                visibleRanges,
                document.lineCount
            )
            webViewService.postNotification(notification)
        }
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
                        editor.colorsScheme.editorFontSize,
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
        TextAttributes(
            null,
            editor.colorsScheme.getColor(EditorColors.CARET_ROW_COLOR),
            null,
            null,
            Font.PLAIN
        )
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
                    editor.markupModel.addRangeHighlighter(
                        editor.getOffset(range.start),
                        editor.getOffset(range.end),
                        HighlighterLayer.LAST,
                        getTextAttributes(editor),
                        HighlighterTargetArea.EXACT_RANGE
                    )
                }
            highlighters.add(highlighter)
        }
    }

    fun reveal(uri: String, range: Range?) = ApplicationManager.getApplication().invokeLater {
        val selectedEditor = FileEditorManager.getInstance(project).selectedTextEditor
        selectedEditor?.let {
            if (it.document.uri == uri && (range == null || it.isRangeVisible(range))) {
                return@invokeLater
            }
        }

        val line = range?.start?.line ?: 0
        val virtualFile = LocalFileSystem.getInstance().findFileByIoFile(File(URI(uri))) ?: return@invokeLater
        val editorManager = FileEditorManager.getInstance(project)
        editorManager.openTextEditor(OpenFileDescriptor(project, virtualFile, line, 0), true)
    }

    val Range.arrayString: String
        get() = "[${start.line},${start.character},${end.line},${end.character}]"

//    var count = 0
//    fun toggleRangeHighlight2(range: Range, highlight: Boolean) = ApplicationManager.getApplication().invokeLater {
//        val editor = FileEditorManager.getInstance(project).selectedTextEditor ?: return@invokeLater
//        val highlighters =
//            rangeHighlighters[editor] ?: throw IllegalStateException("No highlighters found for editor $editor")
//
//        if (!highlight) {
//            synchronized(highlighters) {
//                println("remove ${range.arrayString}")
//                println(--count)
//                val highlighter = highlighters[range]
//                    ?: throw IllegalStateException("No highlighter found for range $range")
//                editor.markupModel.removeHighlighter(highlighter)
//                highlighters.remove(range)
//            }
//            return@invokeLater
//        }
//
//        val textAttributes = TextAttributes(
//            null, //editor.colorsScheme.getColor(EditorColors.CARET_ROW_COLOR),
//            editor.colorsScheme.getColor(EditorColors.CARET_ROW_COLOR),
//            null, //editor.colorsScheme.getColor(EditorColors.CARET_ROW_COLOR),
//            null, //EffectType.BOXED,
//            Font.PLAIN
//        )
//
//        synchronized(highlighters) {
//            println("add ${range.arrayString}")
//            println(++count)
//            val highlighter = if (range.start == range.end && range.start.character == 0) {
//                editor.markupModel.addLineHighlighter(
//                    range.start.line, HighlighterLayer.LAST, textAttributes
//                )
//            } else {
//                editor.markupModel.addRangeHighlighter(
//                    editor.getOffset(range.start),
//                    editor.getOffset(range.end),
//                    HighlighterLayer.LAST,
//                    textAttributes,
//                    HighlighterTargetArea.EXACT_RANGE
//                )
//            }
//            highlighters[range] = highlighter
//        }
//    }
}

val Document.uri: String?
    get() {
        val file = FileDocumentManager.getInstance().getFile(this) ?: return null
        return file.uri
    }

fun Document.lspPosition(offset: Int): Position {
    val line = getLineNumber(offset)
    val lineStart = getLineStartOffset(line)
    val lineTextBeforeOffset = getText(TextRange.create(lineStart, offset))
    val column = lineTextBeforeOffset.length
    return Position(line, column)
}

val Editor.selectionOrCurrentLine: Range
    get() = if (selectionModel.hasSelection()) {
        Range(document.lspPosition(selectionModel.selectionStart), document.lspPosition(selectionModel.selectionEnd))
    } else {
        val logicalPos = caretModel.currentCaret.logicalPosition
        val startOffset = logicalPositionToOffset(LogicalPosition(logicalPos.line, 0))
        val endOffset = logicalPositionToOffset(LogicalPosition(logicalPos.line, Int.MAX_VALUE))
        Range(document.lspPosition(startOffset), document.lspPosition(endOffset))
    }


private val Editor.visibleRanges: List<Range>
    get() {
//        editor.scrollingModel
//        editor.lineHeight
//        editor.scrollingModel.verticalScrollOffset
        val visibleArea = scrollingModel.visibleArea

        val viewportStartPoint = visibleArea.location
        val startLogicalPos = xyToLogicalPosition(viewportStartPoint)
        val startOffset = logicalPositionToOffset(startLogicalPos)
        val startLspPos = document.lspPosition(startOffset)

//            println("\n\n\nstartOffset: ${document.lspPosition(startOffset)}")
//            println("First line actual y: ${startActualPoint.y}")
//            println("Visible area min y: ${visibleArea.y}")
//            println("Margin top: $marginTop")

        val viewportEndPoint = Point(
            visibleArea.location.x + visibleArea.width,
            visibleArea.location.y + visibleArea.height
        )
        val endLogicalPos = xyToLogicalPosition(viewportEndPoint)

        val range = Range(
            startLspPos,
            Position(endLogicalPos.line, endLogicalPos.column)
        )

        return listOf(range)
    }

private fun Editor.isRangeVisible(range: Range): Boolean {
    val ranges = this.visibleRanges
    val firstRange = ranges.first()
    val lastRange = ranges.last()
    return range.start.line >= firstRange.start.line && range.end.line <= lastRange.end.line
}


