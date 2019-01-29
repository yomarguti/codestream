using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using CodeStream.VisualStudio.Extensions;

// ReSharper disable UnusedMember.Global

namespace CodeStream.VisualStudio.LSP
{
    internal class CustomMessageHandler
    {
        private static readonly ILogger Log = LogManager.ForContext<CustomMessageHandler>();

        private readonly IEventAggregator _eventAggregator;
        public CustomMessageHandler(IEventAggregator eventAggregator)
        {
            _eventAggregator = eventAggregator;
        }

        [JsonRpcMethod("codeStream/didChangeData")]
        public void OnDidChangeData(JToken e)
        {
            string type = null;

            try
            {
                type = e.Value<string>("type");
                switch (type)
                {
                    case ChangeDataType.Codemarks:
                        _eventAggregator.Publish(new CodemarksChangedEvent { Data = e });
                        break;
                    case ChangeDataType.MarkerLocations:
                        _eventAggregator.Publish(new MarkerLocationsChangedEvent { Data = e });
                        break;
                    case ChangeDataType.Markers:
                        _eventAggregator.Publish(new MarkersChangedEvent { Data = e });
                        break;
                    case ChangeDataType.Posts:
                        _eventAggregator.Publish(new PostsChangedEvent { Data = e });
                        break;
                    case ChangeDataType.Preferences:
                        _eventAggregator.Publish(new PreferencesChangedEvent { Data = e });
                        break;
                    case ChangeDataType.Repositories:
                        _eventAggregator.Publish(new RepositoriesChangedEvent { Data = e });
                        break;
                    case ChangeDataType.Streams:
                        _eventAggregator.Publish(new StreamsChangedEvent { Data = e });
                        break;
                    case ChangeDataType.Teams:
                        _eventAggregator.Publish(new TeamsChangedEvent { Data = e });
                        break;
                    case ChangeDataType.Unreads:
                        _eventAggregator.Publish(new UnreadsChangedEvent { Data = e });
                        break;
                    case ChangeDataType.Users:
                        _eventAggregator.Publish(new UsersChangedChangedEvent { Data = e });
                        break;
                    default:
                        Log.Verbose($"Could not find type={type}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"Type={type}");
            }
        }

        [JsonRpcMethod("codeStream/didChangeConnectionStatus")]
        public void OnDidChangeConnectionStatus(JToken e)
        {
            var message = e.ToObject<ConnectionStatusNotification>();
            _eventAggregator.Publish(new ConnectionStatusChangedEvent
            {
                Reset = message.Reset,
                Status = message.Status
            });
        }

        [JsonRpcMethod("codeStream/didChangeDocumentMarkers")]
        public void OnDidChangeDocumentMarkers(JToken e)
        {
            ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                var message = e.ToObject<DocumentMarkersNotification>();
                _eventAggregator.Publish(new DocumentMarkerChangedEvent { Uri = message.TextDocument.Uri.ToUri() });
            });
        }

        [JsonRpcMethod("codeStream/didChangeVersionCompatibility")]
        public void OnDidChangeVersionCompatibility(JToken e)
        {
            // TODO implement this
            //  System.Diagnostics.Debugger.Break();
        }

        [JsonRpcMethod("codeStream/didLogout")]
        public void OnDidLogout(JToken e)
        {
            var message = e.ToObject<AuthenticationNotification>();
            _eventAggregator.Publish(new AuthenticationChangedEvent { Reason = message.Reason });
        }
    }
}