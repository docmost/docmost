export class CreateChatDto {
  title?: string;
}

export class ChatListDto {
  limit?: number;
  cursor?: string;
}

export class ChatInfoDto {
  chatId: string;
}

export class ChatIdsDto {
  chatIds: string[];
}

export class DeleteChatDto {
  chatId: string;
}

export class UpdateChatTitleDto {
  chatId: string;
  title: string;
}

export class SearchChatsDto {
  query: string;
}

export class SendMessageDto {
  chatId?: string;
  content: string;
  contextPageId?: string;
}
