using Microsoft.VisualStudio.Text.Editor;
using System;
using System.Collections.Concurrent;

namespace CodeStream.VisualStudio.Services {
	public static class WpfTextViewCache {

		private static readonly ConcurrentDictionary<string, IWpfTextView> Documents =
			new ConcurrentDictionary<string, IWpfTextView>(StringComparer.InvariantCultureIgnoreCase);

		public static bool TryAdd(string key, IWpfTextView val) => Documents.TryAdd(key, val);
		public static bool TryGetValue(string key, out IWpfTextView val) => Documents.TryGetValue(key, out val);		
		public static bool TryRemove(string key) {
			return Documents.TryRemove(key, out IWpfTextView val);
		}
	}
}
