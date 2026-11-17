import { useState } from 'react';
import { Box, Text, render, useApp, useInput } from 'ink';
import { PRESETS } from '../core/presets.js';

interface MenuItem {
  id: string;
  label: string;
  hint: string;
  url: string | null;
}

const ITEMS: MenuItem[] = [
  ...PRESETS.map((p) => ({ id: p.id, label: p.label, hint: p.hint, url: p.url })),
  { id: 'custom', label: 'Custom URL…', hint: 'type or paste any http(s) link', url: null },
];

function UrlInput({ onSubmit, onBack }: { onSubmit: (url: string) => void; onBack: () => void }) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.return) {
      if (value.trim().length > 0) onSubmit(value);
    } else if (key.escape) {
      onBack();
    } else if (key.backspace || key.delete) {
      setValue((current) => current.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setValue((current) => current + input);
    }
  });

  return (
    <Box flexDirection="column">
      <Text>
        Custom URL: <Text color="cyan">{value}</Text>
        <Text backgroundColor="white" color="black">
          {' '}
        </Text>
      </Text>
      <Text dimColor>(Enter — start, Esc — back)</Text>
    </Box>
  );
}

function Menu({ onDone }: { onDone: (url: string | null) => void }) {
  const { exit } = useApp();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<'list' | 'input'>('list');

  useInput((_input, key) => {
    if (mode !== 'list') return;
    if (key.upArrow) {
      setSelected((current) => Math.max(0, current - 1));
    } else if (key.downArrow) {
      setSelected((current) => Math.min(ITEMS.length - 1, current + 1));
    } else if (key.return) {
      const item = ITEMS[selected];
      if (!item) return;
      if (item.url !== null) {
        onDone(item.url);
        exit();
      } else {
        setMode('input');
      }
    }
  });

  const finish = (url: string) => {
    onDone(url);
    exit();
  };

  return (
    <Box flexDirection="column">
      <Text>
        <Text bold color="cyan">
          ⚡ netspeed
        </Text>{' '}
        <Text dimColor>— pick a target</Text>
      </Text>
      {mode === 'list' ? (
        <Box flexDirection="column" marginTop={1}>
          {ITEMS.map((item, index) => {
            const active = index === selected;
            return (
              <Text key={item.id}>
                <Text color={active ? 'cyan' : 'dimColor'}>{active ? '❯ ' : '  '}</Text>
                <Text bold={active} color={active ? 'white' : 'dimColor'}>
                  {item.label}
                </Text>
                <Text dimColor> — {item.hint}</Text>
              </Text>
            );
          })}
          <Box marginTop={1}>
            <Text dimColor>(↑/↓ — choose, Enter — start, Ctrl+C — quit)</Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <UrlInput onSubmit={finish} onBack={() => setMode('list')} />
        </Box>
      )}
    </Box>
  );
}

/** Interactive target picker; resolves null when the user quits without choosing. */
export function pickTargetInteractively(): Promise<string | null> {
  return new Promise((resolve) => {
    const instance = render(<Menu onDone={resolve} />);
    void instance.waitUntilExit();
  });
}
