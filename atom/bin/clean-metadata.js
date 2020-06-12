#!/usr/bin/env node
const fs = require("fs");

const fileName = process.argv[2];
const previousVersion = process.argv[3];

const packageMetadata = JSON.parse(fs.readFileSync(fileName, "utf8"));
packageMetadata.dependencies = {};
packageMetadata.devDependencies = {};
packageMetadata.scripts = {};
packageMetadata.version = previousVersion;

fs.writeFileSync(fileName, JSON.stringify(packageMetadata, undefined, "\t"), "utf8");
