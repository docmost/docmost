export function scrollToComment(commentId) {
  const selector = `div[data-comment-id="${commentId}"]`;
  const commentElement = document.querySelector(selector);
  if (commentElement) {
    commentElement.scrollIntoView({ behavior: 'smooth' });
  }
}

export const scrollToCommentInScrollArea = (commentId, scrollAreaRef) => {
  const commentElement = scrollAreaRef.current.querySelector(`[data-comment-id="${commentId}"]`);

  if (commentElement) {
    const scrollArea = scrollAreaRef.current;
    const commentTop = commentElement.offsetTop;
    const scrollAreaTop = scrollArea.offsetTop;

    scrollArea.scrollTop = commentTop - scrollAreaTop;
  }
};
