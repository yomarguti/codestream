package com.codestream

import com.codestream.agent.AgentService
import com.codestream.authentication.AuthenticationService
import com.codestream.editor.EditorService
import com.codestream.notification.NotificationComponent
import com.codestream.session.SessionService
import com.codestream.settings.SettingsService
import com.codestream.webview.WebViewService
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project

val Project.codeStream: CodeStreamComponent?
    get() =
        if (!isDisposed) getComponent(CodeStreamComponent::class.java)
        else null

val Project.notificationComponent: NotificationComponent?
    get() =
        if (!isDisposed) getComponent(NotificationComponent::class.java)
        else null

val Project.agentService: AgentService?
    get() = getService(AgentService::class.java)

val Project.authenticationService: AuthenticationService?
    get() = getService(AuthenticationService::class.java)

val Project.editorService: EditorService?
    get() = getService(EditorService::class.java)

val Project.sessionService: SessionService?
    get() = getService(SessionService::class.java)

val Project.settingsService: SettingsService?
    get() = getService(SettingsService::class.java)

val Project.webViewService: WebViewService?
    get() = getService(WebViewService::class.java)

fun <T : Any> Project.getService(serviceClass: Class<T>): T? =
    if (!isDisposed) ServiceManager.getService(this, serviceClass)
    else null
