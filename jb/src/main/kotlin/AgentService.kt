package com.codestream

import com.github.salomonbrys.kotson.fromJson
import com.google.gson.JsonObject
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.future.await
import org.apache.commons.io.FileUtils
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.jsonrpc.RemoteEndpoint
import org.eclipse.lsp4j.jsonrpc.messages.Either
import org.eclipse.lsp4j.launch.LSPLauncher
import protocols.agent.DocumentMarkersParams
import protocols.agent.DocumentMarkersResult
import java.io.File


class AgentService(private val project: Project) : ServiceConsumer(project) {

    private val logger = Logger.getInstance(AgentService::class.java)

    lateinit var initializeResult: InitializeResult
    lateinit var agent: CodeStreamLanguageServer
    lateinit var remoteEndpoint: RemoteEndpoint

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
            logger.info("Initializing CodeStream LSP agent")
            val temp = createTempDir("codestream")
            temp.deleteOnExit()
            val agentJs = File(temp, "agent-vs.js")
            val agentJsMap = File(temp, "agent-vs.js.map")
            val agentLog = File(temp, "agent.log")
            FileUtils.copyToFile(javaClass.getResourceAsStream("/agent/agent-vs.js"), agentJs)
            FileUtils.copyToFile(javaClass.getResourceAsStream("/agent/agent-vs.js.map"), agentJsMap)
            logger.info("CodeStream LSP agent extracted to ${agentJs.absolutePath}")

            val process = GeneralCommandLine(
                "node",
                "--nolazy",
//                "--inspect=6010",
//                "/Users/mfarias/Code/codestream-lsp-agent/dist/agent-vs.js",
                agentJs.absolutePath,
                "--stdio",
                "--log=${agentLog.absolutePath}"
//                "--log=/Users/mfarias/Code/jetbrains-codestream/build/idea-sandbox/system/log/agent.log"
            ).createProcess()

            val client = CodeStreamLanguageClient(project)
            val launcher = LSPLauncher.Builder<CodeStreamLanguageServer>()
                .setLocalService(client)
                .setRemoteInterface(CodeStreamLanguageServer::class.java)
                .setInput(process.inputStream)
                .setOutput(process.outputStream)
                .create()

            agent = launcher.remoteProxy
            remoteEndpoint = launcher.remoteEndpoint
            launcher.startListening()
            initializeResult = agent.initialize(getInitializeParams()).get()
        } catch (e: Exception) {
            logger.error(e)
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
            "serverUrl" to settingsService.state.serverUrl
        )
    }


//    suspend fun sendRequest(id: String, action: String, params: JsonElement?) {
//        val result = remoteEndpoint.request(action, params).await()
//        webViewService.postResponse(id, result, null)
//    }

//    suspend fun getBootstrapState(): BootstrapState {
//        val state = BootstrapState()

//        if (!sessionService.isSignedIn) {
//            return state.apply {
//                capabilities = Capabilities(false, false, false, Services(false)) // state?[]
//                configs = Configs().apply {
//                    email = settingsService.email
//                }
//                env = settingsService.environmentName
//                version = settingsService.environmentVersion
//            }
//        }

//        val reposFuture = agent.fetchRepos(FetchReposParams())
//        val streamsFuture = agent.fetchStreams(FetchStreamsParams())
//        val teamsFuture = agent.fetchTeams(FetchTeamsParams())
//        val usersFuture = agent.fetchUsers(FetchUsersParams())
//        val unreadsFuture = agent.getUnreads(GetUnreadsParams())
//        val preferencesFuture = agent.getPreferences(GetPreferencesParams())
//
//        state.apply {
//            capabilities = Capabilities(false, false, false, Services(false)) // state?[]
//
//            configs = Configs().apply {
//                debug = true
//                email = settingsService.email
//                muteAll = false
//                serverUrl = settingsService.serverUrl
//                showHeadshots = settingsService.showHeadshots
//                showMarkers = settingsService.showMarkers
//                openCommentOnSelect = settingsService.openCommentOnSelect
//            }
//
//            currentUserId = sessionService.userLoggedIn!!.state.userId
//            currentTeamId = sessionService.userLoggedIn!!.state.teamId
//            env = settingsService.environmentName
//            version = settingsService.environmentVersion
//
//            repos = reposFuture.await().repos
//            streams = streamsFuture.await().streams
//            teams = teamsFuture.await().teams
//            unreads = unreadsFuture.await().unreads
//            users = usersFuture.await().users
//            preferences = preferencesFuture.await().preferences
//        }
//
//        return state
//    }

//    suspend fun login(email: String?, password: String?): LoginResult {
//        val params = initializationOptions()
//        params["email"] = email
//        params["passwordOrToken"] = password
//        return login(params)
//    }
//
//    suspend fun loginViaOneTimeCode(token: String): LoginResult {
//        val params = initializationOptions()
//        params["signupToken"] = token
//        return login(params)
//    }
//
//    private suspend fun login(params: Map<String, Any?>): LoginResult {
//        val jsonElement = agent.login(params).await()
//        return LoginResult(jsonElement)
//    }
//
//    suspend fun logout() {
//        agent.logout(LogoutParams()).await()
//    }
//
//    suspend fun getDocumentFromMarker(file: String, repoId: String, markerId: String): DocumentFromMarkerResult {
//        val params = DocumentFromMarkerParams(file, repoId, markerId)
//        return agent.documentFromMarker(params).await()
//    }

    //    @JsonRequest("codestream/textDocument/markers")
    suspend fun documentMarkers(params: DocumentMarkersParams): DocumentMarkersResult {
        val json = remoteEndpoint
            .request("codestream/textDocument/markers", params)
            .await() as JsonObject
        return gson.fromJson(json)
    }
//
//    suspend fun documentMarkers(file: String): DocumentMarkersResult? {
//        if (sessionService.userLoggedIn == null) {
//            return null
//        }
//        val params = DocumentMarkersParams(TextDocument(file))
//        return agent.documentMarkers(params).await()
//    }

}

//class LoginResult(private val jsonElement: JsonElement) {
//    val userLoggedIn: UserLoggedIn
//        get() {
//            val team = teams.find { it.id == teamId }
//            return UserLoggedIn(user, team!!, state, teams.size)
//        }
//
//    val error: String?
//        get() {
//            return jsonElement["result"].obj.get("error")?.nullString
//        }
//
//    private val state: LoginState by lazy {
//        var stateJson = jsonElement["result"]["state"]
//        gson.fromJson<LoginState>(stateJson)
//    }
//
//    private val user: CSUser by lazy {
//        val userJson = jsonElement["result"]["loginResponse"]["user"]
//        gson.fromJson<CSUser>(userJson)
//    }
//
//    private val teamId: String by lazy {
//        jsonElement["result"]["loginResponse"]["teamId"].string
//    }
//
//    private val teams: List<CSTeam> by lazy {
//        val teamsJson = jsonElement["result"]["loginResponse"]["teams"]
//        gson.fromJson<List<CSTeam>>(teamsJson)
//    }
//}
//
//class LoginState {
//    lateinit var userId: String
//    lateinit var teamId: String
//    lateinit var email: String
//}


//class BootstrapState {
//    var capabilities: Capabilities? = null
//    var configs: Configs? = null
//    var env: String? = null
//    var version: String? = null
//    var currentTeamId: String? = null
//    var currentUserId: String? = null
//    var repos: Array<Any>? = null
//    var streams: Array<Any>? = null
//    var teams: Array<Any>? = null
//    var users: Array<Any>? = null
//    var unreads: Map<String, Any>? = null
//    var preferences: Map<String, Any>? = null
//}
//
