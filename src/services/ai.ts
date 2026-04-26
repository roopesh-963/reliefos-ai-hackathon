import api from './http';
import type { ChatMessage } from './assistant';

export const sendAIChatMessage = async (messages: ChatMessage[]): Promise<{ reply: string }> => {
  const { data } = await api.post('/ai/chat', { messages });
  return data;
};
