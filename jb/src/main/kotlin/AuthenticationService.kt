package com.codestream

import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project
import com.squareup.moshi.Moshi



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


    fun bootstrap(id: String) {
        val moshi = Moshi.Builder().build()
        val bootstrap = agentService.getBootstrap(settingsService.getSettings())
        val bootstrapAdapter = moshi.adapter(Bootstrap::class.java)
        webViewService.postMessage(Ipc.toResponseMessage(id, bootstrapAdapter.toJson(bootstrap), null))



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




//        string errorResponse = null;
//        JToken loginResponse;
//        JToken payload = null;

//        if (settings.autoSignIn && !settings.email?.isBlank()) {
//            var token = await _credentialsService.Value.LoadAsync(new Uri(_settingsService.ServerUrl), _settingsService.Email);
//            if (token != null)
//            {
//                loginResponse = await _codeStreamAgent.LoginViaTokenAsync(_settingsService.Email, token.Item2, _settingsService.ServerUrl);
//                var success = false;
//                try
//                {
//                    var error = GetError(loginResponse);
//                    if (error != null)
//                    {
//                        errorResponse = error.ToString();
//                    }
//                    else if (loginResponse != null)
//                    {
//                        var state = GetState(loginResponse);
//                        payload = await _codeStreamAgent.GetBootstrapAsync(_settingsService.GetSettings(), state, true);
//                        _sessionService.SetUserLoggedIn(CreateUser(loginResponse));
//                        success = true;
//                    }
//                }
//                catch (Exception ex)
//                {
//                    errorResponse = ex.ToString();
//                    Log.Verbose(ex, $"{nameof(BootstrapAsync)}");
//                }
//                if (success)
//                {
//                    _eventAggregator.Publish(new SessionReadyEvent());
//                }
//                else
//                {
//                    await _credentialsService.Value.DeleteAsync(new Uri(_settingsService.ServerUrl), _settingsService.Email);
//                }
//            }
//            else
//            {
//                payload = await _codeStreamAgent.GetBootstrapAsync(_settingsService.GetSettings());
//            }
//        } else {
//            payload = agentService.getBootstrap(settings.getSettings())
//        }

//        _browserService.PostMessage(Ipc.ToResponseMessage(messageId, payload, errorResponse));
//        await Task.CompletedTask;
    }

    fun authenticate(id: String, email: String?, password: String?) {

        val loginResponse = agentService.login(email, password)

        println(email)
        println(password)
        var success = false;
//        JToken payload = null;
//        string errorResponse = null;
//        JToken loginResponse = null;
//
//        try
//        {
//            loginResponse = await _codeStreamAgent.LoginAsync(email, password, _settingsService.ServerUrl);
//
//            var error = GetError(loginResponse);
//            if (error != null)
//            {
//                if (Enum.TryParse(error.ToString(), out LoginResult loginResult))
//                {
//                    var handleError = await HandleErrorAsync(loginResult);
//                    if (!handleError)
//                    {
//                        await Task.CompletedTask;
//                    }
//                    else
//                    {
//                        errorResponse = loginResult.ToString();
//                    }
//                }
//                else
//                {
//                    errorResponse = error.ToString();
//                }
//            }
//            else if (loginResponse != null)
//            {
//                var state = GetState(loginResponse);
//                payload = await _codeStreamAgent.GetBootstrapAsync(_settingsService.GetSettings(), state, true);
//                _sessionService.SetUserLoggedIn(CreateUser(loginResponse));
//                success = true;
//            }
//        }
//        catch (Exception ex)
//        {
//            errorResponse = ex.ToString();
//            Log.Verbose(ex, $"{nameof(AuthenticateAsync)}");
//        }
//        finally
//        {
//            _browserService.PostMessage(Ipc.ToResponseMessage(messageId, payload, errorResponse));
//        }
//
//        if (success)
//        {
//            await OnSuccessAsync(loginResponse, email);
//        }
//        await Task.CompletedTask;
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
