package protocols.agent

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
    email: String?,
    password: String?,
    serverUrl: String,
    extension: Extension,
    ide: Ide,
    traceLevel: String,
    isDebugging: Boolean,
    team: String?,
    proxySupport: String,
    proxySettings: ProxySettings? = null
) : LoginParams(
    email,
    password,
    null,
    serverUrl,
    extension,
    ide,
    traceLevel,
    isDebugging,
    team,
    proxySupport,
    proxySettings
)

class LoginWithTokenParams(
    email: String?,
    token: AccessToken,
    serverUrl: String,
    extension: Extension,
    ide: Ide,
    traceLevel: String,
    isDebugging: Boolean,
    team: String?,
    proxySupport: String,
    proxySettings: ProxySettings? = null
) : LoginParams(
    email,
    token,
    null,
    serverUrl,
    extension,
    ide,
    traceLevel,
    isDebugging,
    team,
    proxySupport,
    proxySettings
)

class LoginWithSignupTokenParams(
    signupToken: String,
    serverUrl: String,
    extension: Extension,
    ide: Ide,
    traceLevel: String,
    isDebugging: Boolean,
    team: String?,
    proxySupport: String,
    proxySettings: ProxySettings? = null
) : LoginParams(
    null,
    null,
    signupToken,
    serverUrl,
    extension,
    ide,
    traceLevel,
    isDebugging,
    team,
    proxySupport,
    proxySettings
)

class LoginResult(
    val capabilities: ServerCapabilities,
    val result: LoginResultDetails
)

class LoginResultDetails(
    val error: String?,
    val state: LoginState?,
    val loginResponse: LoginResponse?
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

class LoginState {
    lateinit var userId: String
    lateinit var teamId: String
    lateinit var email: String
}

class UserLoggedIn(val user: CSUser, val team: CSTeam, val state: LoginState, val teamsCount: Int)

class CSUser(
    @SerializedName("_id")
    var id: String,
    var username: String,
    var email: String
)

class CSTeam {
    @SerializedName("_id")
    lateinit var id: String
    lateinit var name: String
}

class BootstrapParams

class LogoutParams

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