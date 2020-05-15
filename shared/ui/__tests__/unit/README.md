Run unit tests with:

```
npm run test
```

optionally only run a single file:
`npm run test -- utils.test.js`


Run tests with a debugger:
`npm run test-debug`

(then go to chrome://inspect and open the dedicated DevTools for node, add `debugger` statements if you're not able to get a file to pause)


Run tests with a watcher:
`npm run test-watch`

clear the jest cache with:
`./node_modules/.bin/jest --clearCache`

to see the jest config:
`./node_modules/.bin/jest --showConfig`
