export default store => {
    return next => action => {
        const oldState = store.getState();
        const result = next(action);

        console.groupCollapsed(action.type);
        console.debug(action);
        console.debug("old state", oldState);
        console.debug("new state", store.getState());
        console.groupEnd();

        return result;
    };
};
