export const markStreamRead = streamId => async dispatch => {
  if (!streamId) return;
  // TODO
  // window.parent.postMessage(
  //   { type: "codestream:action:mark-stream-read", body: streamId },
  //   "*"
  // );

  // const markReadData = await http.put(
  //   "/read/" + streamId,
  //   {},
  //   session.accessToken
  // );
  // dispatch({ type: "CLEAR_UMI", payload: streamId });
};

export const createPost = (
  streamId,
  parentPostId,
  text,
  codeBlocks,
  mentions,
  extra
) => async (dispatch, getState) => {
  // TODO
};

export const editPost = () => {
  // TODO
};

export const deletePost = () => {
  // TODO
};
