package com.codestream

import com.codestream.editor.EditorService
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project

abstract class ServiceConsumer(private val project: Project) {

    val agentService: AgentService
        get() = ServiceManager.getService(project, AgentService::class.java)

    val authenticationService: AuthenticationService
        get() = ServiceManager.getService(project, AuthenticationService::class.java)

    val editorService: EditorService
        get() = ServiceManager.getService(project, EditorService::class.java)

    val sessionService: SessionService
        get() = ServiceManager.getService(project, SessionService::class.java)

    val webViewService: WebViewService
        get() = ServiceManager.getService(project, WebViewService::class.java)

    val settingsService: SettingsService
        get() = ServiceManager.getService(project, SettingsService::class.java)

}
