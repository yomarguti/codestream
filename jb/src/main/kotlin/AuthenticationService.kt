package com.codestream

import com.google.gson.Gson
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project

val gson
    get() = Gson()

class AuthenticationService(project: Project) {

//    private ISettingsService _settingsService;
//    private readonly ISessionService _sessionService;
//    private readonly ICodeStreamAgentService _codeStreamAgent;
//    private readonly IEventAggregator _eventAggregator;
//    private readonly IBrowserService _browserService;
//    private readonly IIdeService _ideService;
//    private readonly Lazy<ICredentialsService> _credentialsService;


    val agentService: AgentService by lazy {
        ServiceManager.getService(project, AgentService::class.java)
    }
    val credentialsService: CredentialsService by lazy {
        ServiceManager.getService(project, CredentialsService::class.java)
    }
    val sessionService: SessionService by lazy {
        ServiceManager.getService(project, SessionService::class.java)
    }
    val settingsService: SettingsService by lazy {
        ServiceManager.getService(project, SettingsService::class.java)
    }
    val webViewService: WebViewService by lazy {
        ServiceManager.getService(project, WebViewService::class.java)
    }

    suspend fun bootstrap(id: String) {
        val bootstrapState = agentService.getBootstrapState()
        webViewService.postMessage(Ipc.toResponseMessage(id, gson.toJson(bootstrapState), null))
    }

    suspend fun authenticate(id: String, email: String?, password: String?) {
        val loginResult = agentService.login(email, password)
        sessionService.isSignedIn = true

        val loginResponse = loginResult.result!!["loginResponse"] as Map<String, Any> // user // _id
        val user = loginResponse["user"] as Map<String, Any>
        sessionService.userId = user["_id"] as String
        sessionService.teamId = loginResponse["teamId"] as String

        val bootstrapState = agentService.getBootstrapState()
        webViewService.postMessage(Ipc.toResponseMessage(id, gson.toJson(bootstrapState), null));
    }

    fun goToSignup(id: String) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    fun goToSlackSignin(id: String) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    fun validateSignup(id: String) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

}

