package protocols.agent

import com.codestream.Codemark
import com.codestream.TextDocument
import com.google.gson.annotations.SerializedName
import com.intellij.openapi.application.ApplicationInfo
import org.eclipse.lsp4j.Range
import org.eclipse.lsp4j.ServerCapabilities
import java.lang.IllegalStateException

abstract class LoginParams(
    val email: String?,
    val passwordOrToken: Any?,
    val signupToken: String?,
    val serverUrl: String,
    val extension: Extension,
    val ide: Ide,
    val traceLevel: TraceLevel,
    val isDebugging: Boolean,
    val team: String? = null
//    val teamId: String,
)

class LoginWithPasswordParams(
    email: String?,
    password: String?,
    serverUrl: String,
    extension: Extension,
    ide: Ide,
    traceLevel: TraceLevel,
    isDebugging: Boolean,
    team: String?
) : LoginParams(
    email,
    password,
    null,
    serverUrl,
    extension,
    ide,
    traceLevel,
    isDebugging,
    team
)

class LoginWithTokenParams(
    email: String?,
    token: AccessToken,
    serverUrl: String,
    extension: Extension,
    ide: Ide,
    traceLevel: TraceLevel,
    isDebugging: Boolean,
    team: String?
) : LoginParams(
    email,
    token,
    null,
    serverUrl,
    extension,
    ide,
    traceLevel,
    isDebugging,
    team
)

class LoginWithSignupTokenParams(
    signupToken: String,
    serverUrl: String,
    extension: Extension,
    ide: Ide,
    traceLevel: TraceLevel,
    isDebugging: Boolean,
    team: String?
) : LoginParams(
    null,
    null,
    signupToken,
    serverUrl,
    extension,
    ide,
    traceLevel,
    isDebugging,
    team
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

class CSUser (
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

class Extension(val versionFormatted: String)

class Ide {
    val name = "JetBrains"
    val version = ApplicationInfo.getInstance().fullVersion
}

class AccessToken(
    val email: String?,
    val url: String,
    val value: String
)

enum class TraceLevel {
    @SerializedName("silent")
    SILENT,
    @SerializedName("errors")
    ERRORS,
    @SerializedName("verbose")
    VERBOSE,
    @SerializedName("debug")
    DEBUG
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