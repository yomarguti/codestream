using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Composition;
using CodeStream.VisualStudio.Events;

namespace CodeStream.VisualStudio.Packages {
	/// <summary>
	/// This is an interop between MEF and the classic VS service locator
	/// </summary>
	//[PartCreationPolicy(CreationPolicy.Shared)]
	//public class ServiceProviderExports {
	//	private readonly IServiceProvider _serviceProvider;

	//	[ImportingConstructor]
	//	public ServiceProviderExports([Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider) {
	//		_serviceProvider = serviceProvider;
	//	}

	//	[Export]
	//	public ISettingsService SettingsService => GetService<SSettingsService, ISettingsService>();

	//	[Export]
	//	public ISessionService SessionService => GetService<SSessionService, ISessionService>();

	//	[Export]
	//	public ICodeStreamService CodeStreamService => GetService<SCodeStreamService, ICodeStreamService>();

	//	[Export]
	//	public ICodeStreamAgentService CodeStreamAgentService => GetService<SCodeStreamAgentService, ICodeStreamAgentService>();

	//	[Export]
	//	public IWebviewIpc WebviewIpc => GetService<SWebviewIpc, IWebviewIpc>();

	//	[Export]
	//	public IEventAggregator EventAggregator => GetService<SEventAggregator, IEventAggregator>();

	//	I GetService<S, I>() where S : class {
	//		var service = (I)_serviceProvider.GetService(typeof(S));
	//		if (service == null) return default(I);

	//		return service;
	//	}
	//}
}
