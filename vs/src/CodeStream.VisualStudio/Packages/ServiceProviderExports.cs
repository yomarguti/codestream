using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.Packages {
	/// <summary>
	/// This is an interop between MEF and the classic VS service locator
	/// </summary>
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class ServiceProviderExports {
		private readonly IServiceProvider _serviceProvider;

		[ImportingConstructor]
		public ServiceProviderExports([Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider) {
			_serviceProvider = serviceProvider;
		}

		[Export]
		public ISessionService SessionService => GetService<SSessionService, ISessionService>();

		[Export]
		public ICodeStreamService CodeStreamService => GetService<SCodeStreamService, ICodeStreamService>();

		I GetService<S, I>() where S : class {
			var service = (I)_serviceProvider.GetService(typeof(S));
			if (service == null) return default(I);

			return service;
		}
	}
}
