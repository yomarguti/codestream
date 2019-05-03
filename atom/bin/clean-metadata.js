#!/usr/bin/env node
const fs = require("fs");

const fileName = process.argv[2];

const packageMetadata = JSON.parse(fs.readFileSync(fileName, "utf8"));
packageMetadata.dependencies = {};
packageMetadata.devDependencies = {};
packageMetadata.scripts = {};

fs.writeFileSync(fileName, JSON.stringify(packageMetadata, undefined, "\t"), "utf8");
