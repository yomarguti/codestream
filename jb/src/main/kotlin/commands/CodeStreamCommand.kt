package com.codestream.commands

import com.codestream.protocols.webview.HostNotifications
import com.codestream.webViewService
import com.intellij.openapi.application.JBProtocolCommand
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.ProjectManager

class CodeStreamCommand : JBProtocolCommand("codestream") {
    private val logger = Logger.getInstance(CodeStreamCommand::class.java)

    override fun perform(target: String?, parameters: MutableMap<String, String>) {
        logger.info("Handling $target $parameters")
        // TODO which project should be notified?
        val project = ProjectManager.getInstance().openProjects.getOrNull(0) ?: return
        if (!project.isDisposed) {
            val url = "codestream://codestream/$target?" +
                parameters.map { entry -> entry.key + "=" + entry.value }.joinToString("&")
            logger.info("Opening $url in project ${project.basePath}")
            project.webViewService?.postNotification(HostNotifications.DidReceiveRequest(url))
        }
    }
}
