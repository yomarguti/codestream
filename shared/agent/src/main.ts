"use strict";
import { createConnection, ProposedFeatures, TextDocuments } from "vscode-languageserver";
import { CodeStreamAgent } from "./agent";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

new CodeStreamAgent(connection);

connection.listen();
