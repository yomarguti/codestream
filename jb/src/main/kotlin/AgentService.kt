package com.codestream

import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import org.eclipse.lsp4j.ClientCapabilities
import org.eclipse.lsp4j.InitializeParams
import org.eclipse.lsp4j.TextDocumentClientCapabilities
import org.eclipse.lsp4j.WorkspaceClientCapabilities
import org.eclipse.lsp4j.launch.LSPLauncher
import java.io.File


class AgentService(val project: Project) {

    private val logger = Logger.getInstance(AgentService::class.java)

    val settingsService: SettingsService by lazy {
        ServiceManager.getService(project, SettingsService::class.java)
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

            val client = LanguageClientImpl()
            val launcher = LSPLauncher.createClientLauncher(client, process.inputStream, process.outputStream)
            val server = launcher.remoteProxy
//            client.conne
            val launcherFuture = launcher.startListening()

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
                )
            )

            initParams.rootUri = File(project.basePath).toURI().toString()


            val initializeFuture = server.initialize(initParams)

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

    fun getBootstrap(settings: Settings, state: Any? = null, isAuthenticated: Boolean = false): Bootstrap {
        logger.info("getBootstrap")

        val capabilities = Capabilities(false, false, false, Services(false)) // state?[]

        if (!isAuthenticated) {
            val configs = Configs(
                settingsService.serverUrl,
                settingsService.email,
                settingsService.openCommentOnSelect,
                settingsService.showHeadshots,
                settingsService.showMarkers,
                settings.muteAll,
                settingsService.team
            )
            return Bootstrap(capabilities, configs, settingsService.environmentName, settingsService.environmentVersion)
        } else {
            TODO("marcelo not implemented")
        }
    }

    fun login(email: String?, password: String?): Any {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
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

}