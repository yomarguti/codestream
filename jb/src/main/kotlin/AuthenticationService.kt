package com.codestream

import kotlin.concurrent.thread

class AuthenticationService(settings: SettingsService, credentials: CredentialsService) {

//    private ISettingsService _settingsService;
//    private readonly ISessionService _sessionService;
//    private readonly ICodeStreamAgentService _codeStreamAgent;
//    private readonly IEventAggregator _eventAggregator;
//    private readonly IBrowserService _browserService;
//    private readonly IIdeService _ideService;
//    private readonly Lazy<ICredentialsService> _credentialsService;



    fun bootstrap(id: String) = thread {
//        string errorResponse = null;
//        JToken loginResponse;
//        JToken payload = null;
//
//        if (_settingsService.AutoSignIn && !_settingsService.Email.IsNullOrWhiteSpace())
//        {
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
//        }
//        else
//        {
//            payload = await _codeStreamAgent.GetBootstrapAsync(_settingsService.GetSettings());
//        }
//
//        _browserService.PostMessage(Ipc.ToResponseMessage(messageId, payload, errorResponse));
//        await Task.CompletedTask;
    }

    fun authenticate(id: String) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
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
