package com.codestream

import com.codestream.editor.baseUri
import com.github.salomonbrys.kotson.fromJson
import com.google.gson.JsonObject
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.SystemInfo
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import org.apache.commons.io.FileUtils
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.jsonrpc.RemoteEndpoint
import org.eclipse.lsp4j.jsonrpc.messages.Either
import org.eclipse.lsp4j.launch.LSPLauncher
import protocols.agent.CreatePermalinkParams
import protocols.agent.CreatePermalinkResult
import protocols.agent.DocumentMarkersParams
import protocols.agent.DocumentMarkersResult
import java.io.File
import java.io.InputStream
import java.io.PrintStream
import java.nio.file.Files
import java.nio.file.attribute.PosixFilePermission
import java.util.*


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
            val process = createProcess()
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

    private fun createProcess(): Process {
        val temp = createTempDir("codestream")
        temp.deleteOnExit()
        val process = if (DEBUG) {
            val agentJs = File(temp, "agent-pkg.js")
            val agentJsMap = File(temp, "agent-pkg.js.map")
            // val agentLog = File(temp, "agent.log")
            FileUtils.copyToFile(javaClass.getResourceAsStream("/agent/agent-pkg.js"), agentJs)
            FileUtils.copyToFile(javaClass.getResourceAsStream("/agent/agent-pkg.js.map"), agentJsMap)
            logger.info("CodeStream LSP agent extracted to ${agentJs.absolutePath}")
            GeneralCommandLine(
                "node",
                "--nolazy",
                "--inspect=6010",
                agentJs.absolutePath,
                "--stdio"
                // "--log=${agentLog.absolutePath}"
            ).createProcess()
        } else {
            val perms = setOf(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE,
                PosixFilePermission.OWNER_EXECUTE
            )
            val agentDestFile = getAgentDestFile(temp)
            FileUtils.copyToFile(javaClass.getResourceAsStream(getAgentResourcePath()), agentDestFile)
            if (platform == Platform.MAC || platform == Platform.LINUX) {
                Files.setPosixFilePermissions(agentDestFile.toPath(), perms)
            }
            logger.info("CodeStream LSP agent extracted to ${agentDestFile.absolutePath}")

            if (platform == Platform.LINUX) {
                val xdgOpen = File(temp, "xdg-open")
                FileUtils.copyToFile(javaClass.getResourceAsStream("/agent/xdg-open"), xdgOpen)
                Files.setPosixFilePermissions(xdgOpen.toPath(), perms)
                logger.info("xdg-open extracted to ${xdgOpen.absolutePath}")
            }

            GeneralCommandLine(
                agentDestFile.absolutePath,
                "--stdio"
            ).createProcess()
        }

        captureErrorStream(process)
        GlobalScope.launch {
            val code = process.waitFor()
            logger.info("LSP agent terminated with exit code $code")
        }

        return process
    }

    private fun captureErrorStream(process: Process) {
        Thread(Runnable {
            val sc = Scanner(process.errorStream)
            while (sc.hasNextLine()) {
                val nextLine = sc.nextLine()
                logger.error(nextLine)
            }
        }).start()
    }

    private fun getAgentResourcePath(): String {
        return when (platform) {
            Platform.LINUX -> "/agent/agent-pkg-linux-x64"
            Platform.MAC -> "/agent/agent-pkg-macos-x64"
            Platform.WIN32 -> "/agent/agent-pkg-win-x86.exe"
            Platform.WIN64 -> "/agent/agent-pkg-win-x64.exe"
        }
    }

    private fun getAgentDestFile(tempFolder: File): File {
        return when (platform) {
            Platform.LINUX -> File(tempFolder, "codestream-agent")
            Platform.MAC -> File(tempFolder, "codestream-agent")
            Platform.WIN32 -> File(tempFolder, "codestream-agent.exe")
            Platform.WIN64 -> File(tempFolder, "codestream-agent.exe")
        }.also {
            it.setExecutable(true)
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

        initParams.rootUri = project.baseUri
        return initParams
    }

    private fun initializationOptions(): MutableMap<String, Any?> {
        return mutableMapOf(
            "recordRequests" to false,
            "traceLevel" to "debug",
            "extension" to mapOf("versionFormatted" to settingsService.environmentVersion),
            "ide" to mapOf(
                "name" to "JetBrains",
                "version" to ApplicationInfo.getInstance().fullVersion
            ),
            "serverUrl" to settingsService.state.serverUrl
        )
    }

    suspend fun documentMarkers(params: DocumentMarkersParams): DocumentMarkersResult {
        val json = remoteEndpoint
            .request("codestream/textDocument/markers", params)
            .await() as JsonObject
        val result = gson.fromJson<DocumentMarkersResult>(json)

        // Numbers greater than Integer.MAX_VALUE are deserialized as -1. It should not happen,
        // but some versions of the plugin might do that trying to represent a whole line.
        for (marker in result.markers) {
            if (marker.range.end.character == -1) {
                marker.range.end.character = Integer.MAX_VALUE
            }
        }

        return result
    }

    suspend fun createPermalink(params: CreatePermalinkParams): CreatePermalinkResult {
        val json = remoteEndpoint
            .request("codestream/textDocument/markers/create/link", params)
            .await() as JsonObject
        return gson.fromJson(json)
    }
}




val platform: Platform by lazy {
    when {
        SystemInfo.isLinux -> Platform.LINUX
        SystemInfo.isMac -> Platform.MAC
        SystemInfo.isWindows && SystemInfo.is32Bit -> Platform.WIN32
        SystemInfo.isWindows && SystemInfo.is64Bit -> Platform.WIN64
        else -> throw IllegalStateException("Unable to detect system platform")
    }
}

enum class Platform {
    LINUX,
    MAC,
    WIN32,
    WIN64
}
