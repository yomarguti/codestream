package com.codestream

import com.fasterxml.jackson.annotation.JsonInclude
import com.google.gson.JsonElement
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.future.await
import org.eclipse.lsp4j.ClientCapabilities
import org.eclipse.lsp4j.InitializeParams
import org.eclipse.lsp4j.TextDocumentClientCapabilities
import org.eclipse.lsp4j.WorkspaceClientCapabilities
import org.eclipse.lsp4j.jsonrpc.RemoteEndpoint
import org.eclipse.lsp4j.launch.LSPLauncher
import java.io.File


class AgentService(val project: Project) {

    private val logger = Logger.getInstance(AgentService::class.java)

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

            val client = CodeStreamLanguageClient(webViewService)

//            val jsonConfigurator: Consumer<GsonBuilder> = { builder -> println(builder) }


//            val serializer = object : JsonSerializer<Merchant>() {
//                fun serialize(src: Merchant, typeOfSrc: Type, context: JsonSerializationContext): JsonElement {
//                    val jsonMerchant = JsonObject()
//
//                    jsonMerchant.addProperty("Id", src.getId())
//
//                    return jsonMerchant
//                }
//            }
//
//            val gsonConfigurator = { t: GsonBuilder? ->
//
//            }
            val launcher = LSPLauncher.Builder<CodeStreamLanguageServer>()
                .setLocalService(client)
                .setRemoteInterface(CodeStreamLanguageServer::class.java)
                .setInput(process.inputStream)
                .setOutput(process.outputStream)
//                .configureGson(gsonConfigurator)
                .create()

//            val launcher2 = LSPLauncher.createClientLauncher(client, process.inputStream, process.outputStream)
//            LSPLauncher.create
            server = launcher.remoteProxy
            remoteEndpoint = launcher.remoteEndpoint
//            client.conne
            val launcherFuture = launcher.startListening()


            val initializeFuture = server.initialize(getInitializeParams())

             initializeFuture.handle { t, u ->
                {
                    println("handle")
                    println(t)
                    logger.info(u)
                }
            }
//            initializeFuture.thenApply {  }


//            initializeFuture.handle((s, t) -> s != null ? s : "Hello, Stranger!");
            initializeFuture.thenApply { res ->
                {
                    logger.info("Initialized $res")
                }
            }

            val result = initializeFuture.get()
            println(result)
//            initializeFuture.h


//            server.initialize(initParams).thenApply(res -> {
            //                initializeResult = res
//                LOG.info("Got initializeResult for " + serverDefinition + " ; " + rootPath)
//                requestManager = new SimpleRequestManager(this, languageServer, client, res.getCapabilities)
//                setStatus(STARTED)
//                res
//            })


//            val client = MyLanguageClient()
//            val launcher = LSPLauncher.createClientLauncher(client, input, output)
//            client.setServer(launcher.remoteProxy)
//            launcher.startListening()

        } catch (e: Exception) {
            e.printStackTrace()
        }


//        try {
//            val (inputStream, outputStream) = serverDefinition.start(rootPath)
//            client = serverDefinition.createLanguageClient
//            val initParams = new InitializeParams
//                    initParams.setRootUri(FileUtils.pathToUri(rootPath))
//            val launcher = LSPLauncher.createClientLauncher(client, inputStream, outputStream)
//
//            this.languageServer = launcher.getRemoteProxy
//            client.connect(languageServer, this)
//            this.launcherFuture = launcher.startListening
//            //TODO update capabilities when implemented
//            val workspaceClientCapabilities = new WorkspaceClientCapabilities
//                    workspaceClientCapabilities.setApplyEdit(true)
//            //workspaceClientCapabilities.setDidChangeConfiguration(new DidChangeConfigurationCapabilities)
//            workspaceClientCapabilities.setDidChangeWatchedFiles(new DidChangeWatchedFilesCapabilities)
//            workspaceClientCapabilities.setExecuteCommand(new ExecuteCommandCapabilities)
//            workspaceClientCapabilities.setWorkspaceEdit(new WorkspaceEditCapabilities(true))
//            workspaceClientCapabilities.setSymbol(new SymbolCapabilities)
//            workspaceClientCapabilities.setWorkspaceFolders(false)
//            workspaceClientCapabilities.setConfiguration(false)
//            val textDocumentClientCapabilities = new TextDocumentClientCapabilities
//                    textDocumentClientCapabilities.setCodeAction(new CodeActionCapabilities)
//            //textDocumentClientCapabilities.setCodeLens(new CodeLensCapabilities)
//            //textDocumentClientCapabilities.setColorProvider(new ColorProviderCapabilities)
//            textDocumentClientCapabilities.setCompletion(new CompletionCapabilities(new CompletionItemCapabilities(false)))
//            textDocumentClientCapabilities.setDefinition(new DefinitionCapabilities)
//            textDocumentClientCapabilities.setDocumentHighlight(new DocumentHighlightCapabilities)
//            //textDocumentClientCapabilities.setDocumentLink(new DocumentLinkCapabilities)
//            //textDocumentClientCapabilities.setDocumentSymbol(new DocumentSymbolCapabilities)
//            //textDocumentClientCapabilities.setFoldingRange(new FoldingRangeCapabilities)
//            textDocumentClientCapabilities.setFormatting(new FormattingCapabilities)
//            textDocumentClientCapabilities.setHover(new HoverCapabilities)
//            //textDocumentClientCapabilities.setImplementation(new ImplementationCapabilities)
//            textDocumentClientCapabilities.setOnTypeFormatting(new OnTypeFormattingCapabilities)
//            textDocumentClientCapabilities.setRangeFormatting(new RangeFormattingCapabilities)
//            textDocumentClientCapabilities.setReferences(new ReferencesCapabilities)
//            textDocumentClientCapabilities.setRename(new RenameCapabilities)
//            textDocumentClientCapabilities.setSemanticHighlightingCapabilities(new SemanticHighlightingCapabilities(false))
//            textDocumentClientCapabilities.setSignatureHelp(new SignatureHelpCapabilities)
//            textDocumentClientCapabilities.setSynchronization(new SynchronizationCapabilities(true, true, true))
//            //textDocumentClientCapabilities.setTypeDefinition(new TypeDefinitionCapabilities)
//            initParams.setCapabilities(new ClientCapabilities(workspaceClientCapabilities, textDocumentClientCapabilities, null))
//            initParams.setInitializationOptions(this.serverDefinition.getInitializationOptions(URI.create(initParams.getRootUri)))
//            initializeFuture = languageServer.initialize(initParams).thenApply((res: InitializeResult) => {
//                initializeResult = res
//                LOG.info("Got initializeResult for " + serverDefinition + " ; " + rootPath)
//                requestManager = new SimpleRequestManager(this, languageServer, client, res.getCapabilities)
//                setStatus(STARTED)
//                res
//            })
//            initializeStartTime = System.currentTimeMillis
//        } catch {
//            case e@(_: LSPException | _: IOException) =>
//            LOG.warn(e)
//            ApplicationUtils.invokeLater(() => Messages.showErrorDialog("Can't start server, please check settings\n" + e.getMessage, "LSP Error"))
//            stop()
//            removeServerWrapper()
//        }
    }

    private fun getInitializeParams(email: String? = null, passwordOrToken: String? = null): InitializeParams {
        val workspaceClientCapabilities = WorkspaceClientCapabilities()
        workspaceClientCapabilities.configuration = true
        val textDocumentClientCapabilities = TextDocumentClientCapabilities()
        val clientCapabilities =
            ClientCapabilities(workspaceClientCapabilities, textDocumentClientCapabilities, null)
        val initParams = InitializeParams()
        initParams.capabilities = clientCapabilities
        initParams.initializationOptions = mapOf(
            "traceLevel" to "debug",
            "extension" to mapOf("versionFormatted" to "6.6.6"),
            "ide" to mapOf(
                "name" to "IntelliJ",
                "version" to "666"
            ),
            "serverUrl" to settingsService.serverUrl,
            "email" to email,
            "passwordOrToken" to passwordOrToken
        )

        initParams.rootUri = File(project.basePath).toURI().toString()
        return initParams
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

            currentTeamId = sessionService.teamId
            currentUserId = sessionService.userId
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








//            state.currentTeamId = this.session.team.id;
//            state.currentUserId = this.session.userId;
//            state.env = this.session.environment;
//            state.version = Container.versionFormatted;
//
//            if (this._uiContext) state.context = this._uiContext;
//
//            const [
//                    reposResponse,
//                    streamsResponse,
//                    teamsResponse,
//                    unreadsResponse,
//                    usersResponse,
//                    preferencesResponse
//            ] = await promise;
//
//            state.repos = reposResponse.repos;
//            state.streams = streamsResponse.streams;
//            state.teams = teamsResponse.teams;
//            state.unreads = unreadsResponse.unreads;
//            state.users = usersResponse.users;
//            state.preferences = preferencesResponse.preferences;
//
//            if (this._streamThread !== undefined) {
//                state.currentStreamId = this._streamThread.stream.id;
//                state.currentThreadId = this._streamThread.id;
//            }
//
//            return state;
    }

//    fun getBootstrap(settings: Settings, state: Any? = null, isAuthenticated: Boolean = false): Bootstrap {
//        logger.info("getBootstrap")
//
//        val capabilities = Capabilities(false, false, false, Services(false)) // state?[]
//
//        if (!isAuthenticated) {
//            val configs = Configs(
//                settingsService.serverUrl,
//                settingsService.email,
//                settingsService.openCommentOnSelect,
//                settingsService.showHeadshots,
//                settingsService.showMarkers,
//                settings.muteAll,
//                settingsService.team
//            )
//            return Bootstrap(capabilities, configs, settingsService.environmentName, settingsService.environmentVersion)
//        } else {
//            TODO("marcelo not implemented")
//        }
//    }

    suspend fun login(email: String?, password: String?): LoginResult {
        val initParams = getInitializeParams(email, password)
        return server.login(initParams.initializationOptions as Map<String, Any>).await()
    }


//        return JToken.FromObject(new
//        {
//            capabilities = capabilities,
//            configs = new
//            {
//                serverUrl = _settingsService.ServerUrl,
//                email = _settingsService.Email,
//                openCommentOnSelect = _settingsService.OpenCommentOnSelect,
//                showHeadshots = _settingsService.ShowHeadshots,
//                showMarkers = _settingsService.ShowMarkers,
//                muteAll = settings.MuteAll,
//                team = _settingsService.Team
//            },
//            env = _settingsService.GetEnvironmentName(),
//            version = _settingsService.GetEnvironmentVersionFormatted()
//        });
//        println("bla")
//    }

    suspend fun sendRequest(id: String, action: String, params: JsonElement) {
        val result = remoteEndpoint.request(action, params).await()
        webViewService.postMessage(Ipc.toResponseMessage(id, result.toString(), null))
    }

}

@JsonInclude(JsonInclude.Include.NON_NULL)
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

@JsonInclude(JsonInclude.Include.NON_NULL)
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