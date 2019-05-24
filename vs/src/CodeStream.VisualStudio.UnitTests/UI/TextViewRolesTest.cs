using System.Linq;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.UnitTests.Stubs;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.UI {
	[TestClass]
	public class TextViewRolesTest {
		[TestMethod]
		[DataRow(new [] { "PRIMARYDOCUMENT", "INTERACTIVE", "DOCUMENT","EDITABLE"})]
		public void RolesValidTest(string[] s) {
			Assert.IsTrue(new TextViewRoleSet(s.ToList()).HasValidRoles());
		}

		[TestMethod]
		[DataRow(new[] { "PRIMARYDOCUMENT", "INTERACTIVE", "DOCUMENT", "EDITABLE", "DIFF" })]
		[DataRow(new[] { "PRIMARYDOCUMENT", "INTERACTIVE", "DIFF"})]
		public void RolesInvalidTest(string[] s) {
			Assert.IsFalse(new TextViewRoleSet(s.ToList()).HasValidRoles());
		}
	}
}
