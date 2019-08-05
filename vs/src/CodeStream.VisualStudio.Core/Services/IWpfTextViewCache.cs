using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Text.Editor;

namespace CodeStream.VisualStudio.Core.Services {
	[Guid("56467630-0C95-4CDE-857A-E59AC6FDB852")]
	public interface IWpfTextViewCache {
		void Add(string key, IWpfTextView wpfTextView);
		void Remove(string key, IWpfTextView wpfTextView);
		bool TryGetValue(string key, out IWpfTextView wpfTextView);
		int Count();
	}
}
