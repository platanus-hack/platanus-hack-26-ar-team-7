import React from 'react';
import { Bot, Terminal } from 'lucide-react';

type Props = { size?: number };

export function ClaudeCodeIcon({ size = 18 }: Props): JSX.Element {
  return <Bot size={size} aria-hidden />;
}

export function CodexIcon({ size = 18 }: Props): JSX.Element {
  return <Terminal size={size} aria-hidden />;
}
