using System;
using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.Extensions {
	[TestClass]
	public class UriExtensionsTests {
		[TestMethod]
		public void EqualsIgnoreCaseTest() {
			Assert.IsTrue(new Uri("file:///c%3A/cheese.js").EqualsIgnoreCase(new Uri("file:///c:/cheese.js")));
			Assert.IsTrue(new Uri("file:///c:/cheese.js").EqualsIgnoreCase(new Uri("file:///c%3A/cheese.js")));
		}
		[TestMethod]
		public void ToUriTest() {
			Assert.AreEqual( "file:///c:/cheese.js", "file:///c%3A/cheese.js".ToUri().ToString());
		}
	}
}
