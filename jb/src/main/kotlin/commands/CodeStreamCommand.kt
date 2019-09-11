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
        val project = ProjectManager.getInstance().defaultProject
        if (!project.isDisposed) {
            val url = "$target?" + parameters.map { entry -> entry.key + "=" + entry.value }.joinToString("&")
            project.webViewService?.postNotification(HostNotifications.DidReceiveRequest(url))
        }
    }
}
