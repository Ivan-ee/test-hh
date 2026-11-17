import { useEffect, useState } from 'react';
import { Text } from 'ink';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;

/** Braille spinner — state indication with a steady linear cadence. */
export function Spinner({ label, color = 'cyan' }: { label: string; color?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % FRAMES.length);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color={color}>
      {FRAMES[frame]} {label}
    </Text>
  );
}
