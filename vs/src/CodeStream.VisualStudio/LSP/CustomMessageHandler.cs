using System;
using CodeStream.VisualStudio.Events;
using Newtonsoft.Json.Linq;
using StreamJsonRpc;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Shell;
using Serilog;
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
                        _eventAggregator.Publish(new CodemarksChangedEvent
                        {
                            Data = e.ToObject<CodemarksChangedNotification>().Data
                        });
                        break;
                    case ChangeDataType.MarkerLocations:
                        _eventAggregator.Publish(new MarkerLocationsChangedEvent
                        {
                            Data = e.ToObject<MarkerLocationsChangedNotification>().Data
                        });
                        break;
                    case ChangeDataType.Markers:
                        _eventAggregator.Publish(new MarkersChangedEvent
                        {
                            Data = e.ToObject<MarkersChangedNotification>().Data
                        });
                        break;
                    case ChangeDataType.Posts:
                        _eventAggregator.Publish(new PostsChangedEvent
                        {
                            Data = e.ToObject<PostsChangedNotification>().Data
                        });
                        break;
                    case ChangeDataType.Preferences:
                        _eventAggregator.Publish(new PreferencesChangedEvent
                        {
                            Data = e.ToObject<PreferencesChangedNotification>().Data
                        });
                        break;
                    case ChangeDataType.Repositories:
                        _eventAggregator.Publish(new RepositoriesChangedEvent
                        {
                            Data = e.ToObject<RepositoriesChangedNotification>().Data
                        });
                        break;
                    case ChangeDataType.Streams:
                        _eventAggregator.Publish(new StreamsChangedEvent
                        {
                            Data = e.ToObject<StreamsChangedNotification>().Data
                        });
                        break;
                    case ChangeDataType.Teams:
                        _eventAggregator.Publish(new TeamsChangedEvent
                        {
                            Data = e.ToObject<TeamsChangedNotification>().Data
                        });
                        break;
                    case ChangeDataType.Unreads:
                        _eventAggregator.Publish(new UnreadsChangedEvent
                        {
                            Data = e.ToObject<UnreadsChangedNotification>().Data
                        });
                        break;
                    case ChangeDataType.Users:
                        _eventAggregator.Publish(new UsersChangedChangedEvent
                        {
                            Data = e.ToObject<UsersChangedNotification>().Data
                        });
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
                _eventAggregator.Publish(new DocumentMarkerChangedEvent
                {
                    Uri = message.TextDocument.Uri
                });
            });
        }

        [JsonRpcMethod("codeStream/didChangeVersionCompatibility")]
        public void OnDidChangeVersionCompatibility(JToken e)
        {
            //  System.Diagnostics.Debugger.Break();
        }

        [JsonRpcMethod("codeStream/didLogout")]
        public void OnDidLogout(JToken e)
        {
            var message = e.ToObject<AuthenticationNotification>();
            _eventAggregator.Publish(new AuthenticationChangedEvent
            {
                Reason = message.Reason
            });
        }
    }
}