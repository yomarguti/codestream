package protocols.webview

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName
import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range
import protocols.agent.Marker

class LoginRequest(
    val email: String?,
    val password: String?
)

class LoginSSORequest(
    val provider: String
)

class SignedOutBootstrapResponse(
    val capabilities: Capabilities,
    val configs: Map<String, Any?>,
    val env: CodeStreamEnvironment,
    val version: String
)

class SignedInBootstrapResponse(
    val capabilities: Capabilities,
    val configs: Configs,
    val env: CodeStreamEnvironment,
    val version: String,
    val context: JsonElement,
    val editorContext: EditorContext,
    val session: UserSession
)

class Capabilities {
    val channelMute = true
    val codemarkApply = true
    val codemarkCompare = true
    val editorTrackVisibleRange = true
    val services = Services()
}

class Configs(
    val serverUrl: String,
    val email: String?,
    val showHeadshots: Boolean,
    val viewCodemarksInline: Boolean,
    val muteAll: Boolean,
    val debug: Boolean,
    val showFeedbackSmiley: Boolean
)

class Services {
    val vsls = false
}

class UserSession(
    val userId: String
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

class MarkerCompareRequest(
    val marker: Marker
)

class MarkerApplyRequest(
    val marker: Marker
)

class SignupCompleteRequest(
    val email: String,
    val token: String,
    val teamId: String
)

class ValidateThirdPartyAuthRequest(
    val teamId: String?,
    val team: String?,
    val alias: Boolean?
)


