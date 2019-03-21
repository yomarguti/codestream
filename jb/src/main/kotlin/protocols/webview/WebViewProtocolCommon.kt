package protocols.webview

import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range
import protocols.agent.GetRangeScmInfoResponse

//export const MaxRangeValue = 2147483647;

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
    val hasFocus: Boolean
)

class EditorContext(
    val scm: GetRangeScmInfoResponse?,
    val activeFile: String?,
    val lastActiveFile: String?,
    val textEditorVisibleRanges: Array<Range>?,
    val textEditorUri: String?,
    val textEditorSelections: Array<EditorSelection>?,
    val metrics: EditorMetrics?
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