package com.codestream

import com.codestream.agent.AgentService
import com.codestream.authentication.AuthenticationService
import com.codestream.editor.EditorService
import com.codestream.session.SessionService
import com.codestream.settings.SettingsService
import com.codestream.webview.WebViewService
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project

val Project.codeStream: CodeStreamComponent?
    get() =
        if (!isDisposed) getComponent(CodeStreamComponent::class.java)
        else null

val Project.agentService: AgentService?
    get() = getServiceIfNotDisposed(AgentService::class.java)

val Project.authenticationService: AuthenticationService?
    get() = getServiceIfNotDisposed(AuthenticationService::class.java)

val Project.editorService: EditorService?
    get() = getServiceIfNotDisposed(EditorService::class.java)

val Project.sessionService: SessionService?
    get() = getServiceIfNotDisposed(SessionService::class.java)

val Project.settingsService: SettingsService?
    get() = getServiceIfNotDisposed(SettingsService::class.java)

val Project.webViewService: WebViewService?
    get() = getServiceIfNotDisposed(WebViewService::class.java)

fun <T : Any> Project.getServiceIfNotDisposed(serviceClass: Class<T>): T? =
    if (!isDisposed) ServiceManager.getService(this, serviceClass)
    else null
