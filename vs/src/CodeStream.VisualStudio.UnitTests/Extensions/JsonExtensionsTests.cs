using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Newtonsoft.Json.Linq;

namespace CodeStream.VisualStudio.UnitTests.Extensions {
	[TestClass]
	public class JsonExtensionsTests {
		[TestMethod]
		public void ToJsonTest() {

			var foo = new Foo {
				Cheese = "swiss"
			};
			Assert.AreEqual(
				@"{""cheese"":""swiss""}",
				foo.ToJson());
		}

		[TestMethod]
		public void ToJTokenTest() {
			var foo = new Foo {
				Cheese = "swiss"
			};
			var token = foo.ToJToken();
			Assert.AreEqual("swiss", token["cheese"].Value<string>());
			// the following asserts that the camelCase resolver is working
			Assert.AreEqual(null, token["Cheese"]);
		}

		private class Foo {
			public string Cheese { get; set; }
			public Bar Bar { get; set; }
		}
		// ReSharper disable once ClassNeverInstantiated.Local
		private class Bar {
			public string Baz { get; set; }
		}
	}
}
