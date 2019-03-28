package protocols.webview

import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range
import protocols.agent.GetRangeScmInfoResponse

class EditorMargins(
    val top: Int,
    val right: Int,
    val bottom: Int,
    val left: Int
)

class EditorMetrics (
    val fontSize: Int,
    val lineHeight: Int,
    val margins: EditorMargins?
)

class EditorSelection(
    val start: Position,
    val end: Position,
    val cursor: Position
)

class WebViewContext(
    val currentTeamId: String,
    val currentStreamId: String?,
    val threadId: String?,
    val hasFocus: Boolean,
    val panelStack: Array<String>? = null
)

class EditorContext(
    val scm: GetRangeScmInfoResponse? = null,
    val activeFile: String? = null,
    val lastActiveFile: String? = null,
    val textEditorVisibleRanges: List<Range>? = null,
    val textEditorUri: String? = null,
    val textEditorSelections: List<EditorSelection>? = null,
    val metrics: EditorMetrics? = null
)

class EditorInformation(
    val fileName: String?,
    val uri: String?,
    val metrics: EditorMetrics,
    val selections: List<EditorSelection>,
    val visibleRanges: List<Range>,
    val lineCount: Number,
    val languageId: String? = null
)