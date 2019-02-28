package com.codestream

import com.github.salomonbrys.kotson.*
import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import kotlinx.coroutines.future.await
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.jsonrpc.RemoteEndpoint
import org.eclipse.lsp4j.jsonrpc.messages.Either
import org.eclipse.lsp4j.launch.LSPLauncher
import java.io.File
import kotlin.collections.Map
import kotlin.collections.MutableMap
import kotlin.collections.mapOf
import kotlin.collections.mutableMapOf
import kotlin.collections.set


class AgentService(private val project: Project) {

    private val logger = Logger.getInstance(AgentService::class.java)
    private val connectedEditors = mutableMapOf<String, Editor>()

    lateinit var initializeResult: InitializeResult
    lateinit var server: CodeStreamLanguageServer
    lateinit var remoteEndpoint: RemoteEndpoint

    val settingsService: SettingsService by lazy {
        ServiceManager.getService(project, SettingsService::class.java)
    }
    val sessionService: SessionService by lazy {
        ServiceManager.getService(project, SessionService::class.java)
    }
    val webViewService: WebViewService by lazy {
        ServiceManager.getService(project, WebViewService::class.java)
    }

    val capabilities: ServerCapabilities by lazy {
        initializeResult.capabilities
    }

    val syncKind: TextDocumentSyncKind? by lazy {
        val syncOptions: Either<TextDocumentSyncKind, TextDocumentSyncOptions> = capabilities.textDocumentSync
        when {
            syncOptions.isRight -> syncOptions.right.change
            syncOptions.isLeft -> syncOptions.left
            else -> null
        }
    }

    init {
        try {
            val process = ProcessBuilder(
                "node",
                "--nolazy",
                "--inspect=6010",
                "/Users/mfarias/Code/codestream-lsp-agent/dist/agent-vs.js",
                "--stdio",
                "--log=/Users/mfarias/Code/jetbrains-codestream/build/idea-sandbox/system/log/agent.log"
            ).start()
            val client = CodeStreamLanguageClient(project)
            val launcher = LSPLauncher.Builder<CodeStreamLanguageServer>()
                .setLocalService(client)
                .setRemoteInterface(CodeStreamLanguageServer::class.java)
                .setInput(process.inputStream)
                .setOutput(process.outputStream)
                .create()

            server = launcher.remoteProxy
            remoteEndpoint = launcher.remoteEndpoint
            launcher.startListening()
            initializeResult = server.initialize(getInitializeParams()).get()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun getInitializeParams(email: String? = null, passwordOrToken: String? = null): InitializeParams {
        val workspaceClientCapabilities = WorkspaceClientCapabilities()
        workspaceClientCapabilities.configuration = true
        workspaceClientCapabilities.didChangeConfiguration = DidChangeConfigurationCapabilities(false)
        workspaceClientCapabilities.workspaceFolders = true
        val textDocumentClientCapabilities = TextDocumentClientCapabilities()
        val clientCapabilities =
            ClientCapabilities(workspaceClientCapabilities, textDocumentClientCapabilities, null)
        val initParams = InitializeParams()
        initParams.capabilities = clientCapabilities
        initParams.initializationOptions = initializationOptions().apply {
            "email" to email
            "passwordOrToken" to passwordOrToken
        }

        initParams.rootUri = File(project.basePath).toURI().toString()
        return initParams
    }

    private fun initializationOptions(): MutableMap<String, Any?> {
        return mutableMapOf(
            "traceLevel" to "debug",
            "extension" to mapOf("versionFormatted" to "6.6.6"),
            "ide" to mapOf(
                "name" to "IntelliJ",
                "version" to "666"
            ),
            "serverUrl" to settingsService.serverUrl
        )
    }

    suspend fun sendRequest(id: String, action: String, params: JsonElement?) {
        val result = remoteEndpoint.request(action, params).await()
        webViewService.postResponse(id, result, null)
    }

    suspend fun getBootstrapState(): BootstrapState {
        val state = BootstrapState()

        if (!sessionService.isSignedIn) {
            return state.apply {
                capabilities = Capabilities(false, false, false, Services(false)) // state?[]
                configs = Configs().apply {
                    email = settingsService.email
                }
                env = settingsService.environmentName
                version = settingsService.environmentVersion
            }
        }

        val reposFuture = server.fetchRepos(FetchReposParams())
        val streamsFuture = server.fetchStreams(FetchStreamsParams())
        val teamsFuture = server.fetchTeams(FetchTeamsParams())
        val usersFuture = server.fetchUsers(FetchUsersParams())
        val unreadsFuture = server.getUnreads(GetUnreadsParams())
        val preferencesFuture = server.getPreferences(GetPreferencesParams())

        state.apply {
            capabilities = Capabilities(false, false, false, Services(false)) // state?[]

            configs = Configs().apply {
                debug = true
                email = settingsService.email
                muteAll = false
                serverUrl = settingsService.serverUrl
                showHeadshots = settingsService.showHeadshots
                showMarkers = settingsService.showMarkers
                openCommentOnSelect = settingsService.openCommentOnSelect
            }

            currentUserId = sessionService.userLoggedIn!!.state.userId
            currentTeamId = sessionService.userLoggedIn!!.state.teamId
            env = settingsService.environmentName
            version = settingsService.environmentVersion

            repos = reposFuture.await().repos
            streams = streamsFuture.await().streams
            teams = teamsFuture.await().teams
            unreads = unreadsFuture.await().unreads
            users = usersFuture.await().users
            preferences = preferencesFuture.await().preferences
        }

        return state
    }

    suspend fun login(email: String?, password: String?): LoginResult {
        val params = initializationOptions()
        params["email"] = email
        params["passwordOrToken"] = password
        return login(params)
    }

    suspend fun loginViaOneTimeCode(token: String): LoginResult {
        val params = initializationOptions()
        params["signupToken"] = token
        return login(params)
    }

    private suspend fun login(params: Map<String, Any?>): LoginResult {
        val jsonElement = server.login(params).await()
        return LoginResult(jsonElement)
    }

    suspend fun logout() {
        server.logout(LogoutParams()).await()
    }

    suspend fun getDocumentFromMarker(file: String, repoId: String, markerId: String): DocumentFromMarkerResult {
        val params = DocumentFromMarkerParams(file, repoId, markerId)
        return server.documentFromMarker(params).await()
    }

    suspend fun documentMarkers(file: String): DocumentMarkersResult {
        val params = DocumentMarkersParams(TextDocument(file))
        return server.documentMarkers(params).await()
    }

}

class LoginResult(private val jsonElement: JsonElement) {
    val userLoggedIn: UserLoggedIn
        get() {
            val team = teams.find { it.id == teamId }
            return UserLoggedIn(user, team!!, state, teams.size)
        }

    val error: String?
        get() {
            return jsonElement["result"].obj.get("error")?.nullString
        }

    private val state: LoginState by lazy {
        var stateJson = jsonElement["result"]["state"]
        gson.fromJson<LoginState>(stateJson)
    }

    private val user: CSUser by lazy {
        val userJson = jsonElement["result"]["loginResponse"]["user"]
        gson.fromJson<CSUser>(userJson)
    }

    private val teamId: String by lazy {
        jsonElement["result"]["loginResponse"]["teamId"].string
    }

    private val teams: List<CSTeam> by lazy {
        val teamsJson = jsonElement["result"]["loginResponse"]["teams"]
        gson.fromJson<List<CSTeam>>(teamsJson)
    }
}

class LoginState {
    lateinit var userId: String
    lateinit var teamId: String
    lateinit var email: String
}

class UserLoggedIn(val user: CSUser, val team: CSTeam, val state: LoginState, val teamsCount: Int)

class CSUser {
    @SerializedName("_id")
    lateinit var id: String
    lateinit var username: String
    lateinit var email: String
}

class CSTeam {
    @SerializedName("_id")
    lateinit var id: String
    lateinit var name: String
}

class BootstrapState {
    var capabilities: Capabilities? = null
    var configs: Configs? = null
    var env: String? = null
    var version: String? = null
    var currentTeamId: String? = null
    var currentUserId: String? = null
    var repos: Array<Any>? = null
    var streams: Array<Any>? = null
    var teams: Array<Any>? = null
    var users: Array<Any>? = null
    var unreads: Map<String, Any>? = null
    var preferences: Map<String, Any>? = null
}

class Configs {
    var serverUrl: String? = null
    var email: String? = null
    var openCommentOnSelect: Boolean? = null
    var showHeadshots: Boolean? = null
    var showMarkers: Boolean? = null
    var muteAll: Boolean? = null
    var team: String? = null
    var debug: Boolean? = null
}