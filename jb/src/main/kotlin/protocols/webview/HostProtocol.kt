package protocols.webview

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName
import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range
import protocols.agent.Marker

class BootstrapResponse(
    val session: UserSession,
    val capabilities: JsonElement,
    val configs: Configs,
    val context: JsonElement,
    val version: String,
    val ide: Ide
)

class Capabilities {
    val channelMute = true
    val codemarkApply = true
    val codemarkCompare = true
    val editorTrackVisibleRange = true
    val services = Services()
    var providerCanSupportRealtimeChat: Boolean? = null
    val providerSupportsRealtimeChat: Boolean? = null
    val providerSupportsRealtimeEvents: Boolean? = null
}

class Configs(
    val serverUrl: String,
    val email: String?,
    val showHeadshots: Boolean,
    val muteAll: Boolean,
    val debug: Boolean,
    val showFeedbackSmiley: Boolean,
    val team: String?
)

class Ide(
    val name: String
)

class Services {
    val vsls = false
}

class UserSession(
    val userId: String? = null
)

enum class CodeStreamEnvironment {
    @SerializedName("local")
    LOCAL,
    @SerializedName("prod")
    PROD,
    @SerializedName("unknown")
    UNKNOWN
}

class ContextDidChangeNotification(
    val context: WebViewContext
)

class UpdateConfigurationRequest(
    val name: String,
    val value: String?
)

class ActiveEditorContextResponse(val editorContext: EditorContext? = EditorContext())

class EditorRangeHighlightRequest(
    val uri: String,
    val range: Range,
    val highlight: Boolean
)

class EditorRangeRevealRequest(
    val uri: String,
    val range: Range,
    val preserveFocus: Boolean?,
    val atTop: Boolean?
)

class EditorRangeRevealResponse(
    val success: Boolean
)

class EditorRangeSelectRequest(
    val uri: String,
    val selection: EditorSelection,
    val preserveFocus: Boolean?
)

class EditorRangeSelectResponse(
    val success: Boolean
)

class EditorScrollToRequest(
    val uri: String,
    val position: Position,
    val atTop: Boolean
)

class ShellPromptFolderResponse(
    val path: String?,
    val success: Boolean
)

class MarkerCompareRequest(
    val marker: Marker
)

class MarkerApplyRequest(
    val marker: Marker
)


