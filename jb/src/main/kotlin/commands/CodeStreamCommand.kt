package com.codestream.commands

import com.codestream.extensions.intersectsAny
import com.codestream.gson
import com.codestream.protocols.webview.HostNotifications
import com.codestream.webViewService
import com.github.salomonbrys.kotson.fromJson
import com.intellij.openapi.application.JBProtocolCommand
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.ProjectManager
import org.apache.commons.io.FileUtils
import java.io.File
import java.nio.charset.Charset

class CodeStreamCommand : JBProtocolCommand("codestream") {
    private val logger = Logger.getInstance(CodeStreamCommand::class.java)

    override fun perform(target: String?, parameters: MutableMap<String, String>) {
        logger.info("Handling $target $parameters")

        val repoId = parameters["repoId"]
        val repoMapping = repoId?.let {
            val repoMappings = readMappings().repos
            repoMappings[repoId]
        }

        val manager = ProjectManager.getInstance()
        var project = repoMapping?.let { repoMapping ->
            manager.openProjects.find {
                it.intersectsAny(repoMapping.paths)
            }
        }

        if (project != null) {
            logger.info("Repo $repoId maps to project ${project.basePath}")
        } else {
            logger.info("Repo $repoId doesn't map to any open project")
            project = manager.openProjects.getOrNull(0)
            if (project != null) {
                logger.info("There are no open projects")
            } else {
                return
            }
        }

        val projectFilePath = project.projectFilePath

        if (!project.isOpen && projectFilePath != null) {
            ProjectManager.getInstance().loadAndOpenProject(projectFilePath)
        }

        if (!project.isDisposed) {
            val url = "codestream://codestream/$target?" +
                parameters.map { entry -> entry.key + "=" + entry.value }.joinToString("&")
            logger.info("Opening $url in project ${project.basePath}")
            project.webViewService?.postNotification(HostNotifications.DidReceiveRequest(url))
        }
    }

    private fun readMappings() : CodeStreamMappings {
        return try {
            val userHomeDir = File(System.getProperty("user.home"))
            val mappingsFile = userHomeDir.resolve(".codestream").resolve("mappings.json")
            val mappingsJson = FileUtils.readFileToString(mappingsFile, Charset.defaultCharset())
            gson.fromJson(mappingsJson)
        } catch (e: Exception) {
            logger.warn(e)
            CodeStreamMappings()
        }
    }

}

class CodeStreamMappings(
    val repos: Map<String, RepoMapping> = mapOf(),
    val version: String = ""
)

class RepoMapping(
    val paths: Array<String>,
    val defaultPath: String
)
