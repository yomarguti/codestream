using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Shell;
using System;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.Services {
	public interface IServiceFactory<T> {
		T Create();
	}

	public abstract class ServiceFactory<T> : IServiceFactory<T> where T : class {
		private readonly IServiceProvider _serviceProvider;

		protected ServiceFactory([Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider) {
			_serviceProvider = serviceProvider;
		}

		public T Create() {
			var componentModel = _serviceProvider.GetService(typeof(SComponentModel)) as IComponentModel;
			Microsoft.Assumes.Present(componentModel);
			return componentModel.GetService<T>();
		}
	}
}
