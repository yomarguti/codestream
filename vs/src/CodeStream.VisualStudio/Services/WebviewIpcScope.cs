using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using Newtonsoft.Json.Linq;
using System;

namespace CodeStream.VisualStudio.Services
{
    public class WebviewIpcScope : IDisposable
    {
        private bool _disposed;
        private readonly IWebviewIpc _ipc;
        private WebviewIpcMessage _message;

        public WebviewIpcScope(IWebviewIpc ipc, WebviewIpcMessage message)
        {
            if (_disposed) throw new ObjectDisposedException($"{nameof(WebviewIpcScope)}");

            _ipc = ipc;
            _message = new WebviewIpcMessage(message.Id);
        }

        /// <summary>
        /// Creates a scope, that if not completed, sends a generic response message
        /// </summary>
        /// <param name="ipc"></param>
        /// <param name="message"></param>
        /// <returns></returns>
        public static WebviewIpcScope Create(IWebviewIpc ipc, WebviewIpcMessage message)
        {
            return new WebviewIpcScope(ipc, message);
        }

        /// <summary>
        /// Attach additional data to the response message
        /// </summary>
        /// <param name="params"></param>
        /// <param name="error"></param>
        public void FulfillRequest(JToken @params, string error = null)
        {
            if (_disposed) throw new ObjectDisposedException($"{nameof(FulfillRequest)}");

            _message = error.IsNullOrWhiteSpace() ?
                new WebviewIpcMessage(_message.Id, @params) : 
                new WebviewIpcMessage(_message.Id, @params, new JValue(error));
        }

        /// <summary>
        /// Attach an error, if any, to the response
        /// </summary>
        /// <param name="error"></param>
        public void FulfillRequest(string error)
        {
            if (_disposed) throw new ObjectDisposedException($"{nameof(FulfillRequest)}");

            if (error.IsNullOrWhiteSpace()) return;

            _message = new WebviewIpcMessage(_message.Id, _message.Params, new JValue(error));
        }

        /// <summary>
        /// "Marker" to signify the scope is finished -- no additional data is required
        /// </summary>
        public void FulfillRequest()
        {
            if (_disposed) throw new ObjectDisposedException($"{nameof(FulfillRequest)}");
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (_disposed) return;

            if (disposing)
            {
                _ipc.Send(_message);
            }

            _disposed = true;
        }
    }
}