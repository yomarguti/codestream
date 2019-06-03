package protocols.agent

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.annotations.SerializedName
import com.intellij.openapi.application.ApplicationInfo
import org.eclipse.lsp4j.Range
import org.eclipse.lsp4j.ServerCapabilities
import org.eclipse.lsp4j.TextDocumentIdentifier

class ProxySettings(val url: String, val strictSSL: Boolean)

abstract class LoginParams(
    val email: String?,
    val passwordOrToken: Any?,
    val signupToken: String?,
    val serverUrl: String,
    val extension: Extension,
    val ide: Ide,
    val traceLevel: String,
    val isDebugging: Boolean,
    val team: String? = null,
    val proxySupport: String,
    val proxy: ProxySettings? = null,
    val recordRequests: Boolean = false
    // val teamId: String,
)

class LoginWithPasswordParams(
    val email: String?,
    val password: String?,
    val teamId: String?,
    val team: String?
)

class LoginWithTokenParams(
    val token: AccessToken,
    val teamId: String?,
    val team: String?
)

class LoginOtcParams(
    val code: String,
    val teamId: String?,
    val team: String?,
    val alias: Boolean?
)

class LoginResult(
    val loginResponse: LoginResponse?,
    val state: LoginState?,
    val error: String?,
    val extra: String?
) {
    val userLoggedIn: UserLoggedIn
        get() = loginResponse?.let {
            return UserLoggedIn(it.user, it.team, state!!, it.teams.size)
        } ?: throw IllegalStateException("LoginResult has no loginResponse")
}

class LoginResponse(
    val user: CSUser,
    val teamId: String,
    val teams: List<CSTeam>,
    val accessToken: String
) {
    val team: CSTeam
        get() = teams.find { it.id == teamId }
            ?: throw IllegalStateException("User's teams does not contains their own team")
}

class LoginState(
    val userId: String,
    val teamId: String,
    val email: String
)

class UserLoggedIn(val user: CSUser, val team: CSTeam, val state: LoginState, val teamsCount: Int) {
    val userId get() = state.userId
    val teamId get() = state.teamId
}

class CSUser(
    val id: String,
    val username: String,
    val email: String,
    val preferences: CSPreferences
)

class CSPreferences(
    val mutedStreams: Map<String, Boolean>?
)

class CSTeam(
    val id: String,
    val name: String,
    val providerInfo: ProviderInfo?
)

class ProviderInfo(
    val slack: JsonObject?
)

class BootstrapParams

class Extension(val versionFormatted: String) {
    val version: String
    val build: String

    init {
        val parts = versionFormatted.split("+")
        version = parts[0]
        build = parts.getOrElse(1) { "SNAPSHOT" }
    }
}

class Ide {
    val name = "JetBrains"
    val version = ApplicationInfo.getInstance().fullVersion
}

class AccessToken(
    val email: String?,
    val url: String,
    val value: String
)

enum class TraceLevel(val value: String) {
    SILENT("silent"),
    ERRORS("errors"),
    VERBOSE("verbose"),
    DEBUG("debug")
}

class DocumentMarkersParams(val textDocument: TextDocument)

class DocumentMarkersResult(val markers: List<DocumentMarker>, val markersNotLocated: Any)

class DocumentMarker(
    val id: String,
    val codemark: Codemark,
//    creatorName: string;
    val range: Range,
    val summary: String
//    summaryMarkdown: string;
)

class CreatePermalinkParams(
    val uri: String?,
    val range: Range,
    val privacy: String
)

class CreatePermalinkResult(
    val linkUrl: String
)

enum class PermalinkPrivacy(val value: String) {
    PUBLIC("public"),
    PRIVATE("private")
}

class TextDocumentFromKeyParams(val key: Int)

class TextDocumentFromKeyResult(
    val textDocument: TextDocumentIdentifier,
    val range: Range,
    val marker: JsonObject
)

class Codemark(
    val id: String,
    val type: String?,
    val color: String?,
    val streamId: String,
    val postId: String?,
    val status: String?,
    val pinned: Boolean?
)

class TextDocument(val uri: String)

class Post(
    val version: Int?,
    val streamId: String,
    val creatorId: String?,
    val mentionedUserIds: List<String>?,
    val text: String,
    val deactivated: Boolean,
    val hasBeenEdited: Boolean,
    val numReplies: Int,
    val reactions: JsonElement?
) {
    val isNew: Boolean
        get() {
            return if (version != null) {
                version == 1
            } else {
                !deactivated && !hasBeenEdited && numReplies == 0 && reactions == null
            }
        }
}

class Stream(
    val id: String,
    val type: StreamType,
    val name: String?
)

enum class StreamType {
    @SerializedName("channel")
    CHANNEL,
    @SerializedName("direct")
    DIRECT,
    @SerializedName("file")
    FILE
}

class GetStreamParams(
    val streamId: String
)

class GetUserParams(
    val userId: String
)

class Marker(
    val id: String,
    val code: String
)
