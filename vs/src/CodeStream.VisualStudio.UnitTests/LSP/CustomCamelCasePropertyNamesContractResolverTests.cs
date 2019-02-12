using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.LSP;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using System;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.UnitTests.LSP
{
    [TestClass]
    public class CustomCamelCasePropertyNamesContractResolverTests
    {
        [TestMethod]
        public void CamelCasePropertyNamesContractResolverTest()
        {
            var str = JsonConvert.SerializeObject(GetTelemetryRequest(), GetSettings(new CamelCasePropertyNamesContractResolver()));
            var result = str.FromJson<TelemetryRequest>();

            Assert.IsTrue(result.EventName == "Foo");
            Assert.IsTrue(result.Properties["cheese"].ToString() == "yum");
        }

        [TestMethod]
        public void CustomCamelCasePropertyNamesContractResolverTest()
        {
            var str = JsonConvert.SerializeObject(GetTelemetryRequest(), GetSettings(new CustomCamelCasePropertyNamesContractResolver(new HashSet<Type> { typeof(TelemetryProperties) })));
            var result = str.FromJson<TelemetryRequest>();

            Assert.IsTrue(result.EventName == "Foo");
            Assert.IsTrue(result.Properties["Cheese"].ToString() == "yum");
        }

        private TelemetryRequest GetTelemetryRequest()
        {
            var request = new TelemetryRequest
            {
                EventName = "Foo",
                Properties = new TelemetryProperties()
            };
            request.Properties["Cheese"] = "yum";
            return request;
        }

        private JsonSerializerSettings GetSettings(IContractResolver contractResolver)
        {
            return new JsonSerializerSettings
            {
                ContractResolver = contractResolver
            };
        }
    }
}