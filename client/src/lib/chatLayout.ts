/** Reserves a readable message area above the persistent chat input. */
export function chatMessageMinHeight(
  containerHeight: number,
  inputHeight: number
) {
  const verticalPadding = 32;
  const userMessageReserve = 56;
  return Math.max(
    0,
    containerHeight - inputHeight - verticalPadding - userMessageReserve
  );
}
