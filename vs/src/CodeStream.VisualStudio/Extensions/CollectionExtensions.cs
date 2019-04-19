using System.Collections.Concurrent;

namespace CodeStream.VisualStudio.Extensions {
	public static class CollectionExtensions {
		/// <summary>
		/// https://stackoverflow.com/questions/8001133/how-to-empty-a-blockingcollection
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="blockingCollection"></param>
		public static void Clear<T>(this BlockingCollection<T> blockingCollection) {
			if (blockingCollection == null) return;

			while (blockingCollection.Count > 0) {
				T item;
				blockingCollection.TryTake(out item);
			}
		}
	}
}
