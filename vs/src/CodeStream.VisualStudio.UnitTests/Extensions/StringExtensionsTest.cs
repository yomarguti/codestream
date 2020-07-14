using CodeStream.VisualStudio.Core.Extensions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.Extensions {
	[TestClass]
	public class StringExtensionsTest {
		[TestMethod()]
		[DataRow("", true)]
		[DataRow("   ", true)]
		[DataRow(null, true)]		
		[DataRow("abc", false)]
		public void IsNullOrWhiteSpaceTest(string test, bool expected) {
			Assert.AreEqual(expected, test.IsNullOrWhiteSpace());
		}

		[TestMethod()]
		[DataRow("a", "A", true)]
		[DataRow("B", "A", false)]
		public void EqualsIgnoreCaseTest(string test1, string test2, bool expected) {
			Assert.AreEqual(expected, StringExtensions.EqualsIgnoreCase(test1, test2));
		}

		[TestMethod()]
		[DataRow("Visual Studio CommunityЯ 2019", "Visual Studio Community 2019")]		
		[DataRow("Visual!@#$%^&*() Studio CommunityЯ© 2019", "Visual Studio Community 2019")]
		[DataRow("Visual Studio Community® 2019", "Visual Studio Community 2019")]
		[DataRow("!Visual+ Studio =Community® 2019?", "Visual Studio Community 2019")]
		[DataRow("Visual Studio Enterpriseя2019", "Visual Studio Enterprise2019")]
		public void ToAplhaNumericPlusTest(string test, string expected) {
			Assert.AreEqual(expected, test.ToAplhaNumericPlusSafe());
		}

		[TestMethod()]
		[DataRow("abc", 3, "abc")]
		[DataRow("abc", 5, "abc")]
		[DataRow("abcdefghij", 3, "abc...")]
		public void TruncateTest(string test, int maxLength, string expected) {
			Assert.AreEqual(expected, test.Truncate(maxLength));
		}

		[TestMethod()]
		[DataRow("a\nb\nc", "a\r\nb\r\nc")]
		[DataRow("a\nb\nc", "a\r\nb\r\nc")]
		[DataRow("a\nbc", "a\r\nbc")]
		[DataRow("a\r\nb\r\nc", "a\r\nb\r\nc")]		
		public void NormalizeLineEndingsTest(string test, string expected) {
			Assert.AreEqual(expected, test.NormalizeLineEndings());
		}
	}
}
