export function getChatBarVisibility(chatExpanded: boolean) {
  return chatExpanded ? "expanded" : "hidden"
}

export function getNextChatExpanded(chatExpanded: boolean) {
  return !chatExpanded
}

export function shouldShowWritingChat(chatExpanded: boolean) {
  return chatExpanded
}

export function getChapterToolbarOrder() {
  return ["ai-session", "de-ai", "chapter-status"]
}
