import { Text } from 'ink';
import { connectMs } from '../core/domain.js';
import type { ProbeResult } from '../core/domain.js';
import { formatBytes, formatDuration, formatRate } from '../core/format.js';

function label(probe: ProbeResult): string {
  return `#${String(probe.index + 1).padStart(2, ' ')}`;
}

/** One finished probe — rendered once in the static zone, never re-renders. */
export function ProbeRow({ probe }: { probe: ProbeResult }) {
  if (probe.status === 'failed') {
    return (
      <Text>
        <Text color="red">✘</Text> <Text dimColor>{label(probe)}</Text>{' '}
        <Text color="red">{probe.error}</Text>
        {probe.bytes > 0 && <Text dimColor> (got {formatBytes(probe.bytes)})</Text>}
      </Text>
    );
  }

  const connect = probe.phases ? connectMs(probe.phases) : null;
  return (
    <Text>
      <Text color="green">✔</Text> <Text dimColor>{label(probe)}</Text>{' '}
      <Text>{formatDuration(probe.durationMs)}</Text>{' '}
      <Text dimColor>{formatBytes(probe.bytes)}</Text>{' '}
      <Text color="cyan">{formatRate(probe.speedBps ?? 0)}</Text>
      {connect !== null && probe.phases && (
        <Text dimColor>
          {'  '}
          connect {formatDuration(connect)} · ttfb {formatDuration(probe.phases.ttfbMs ?? 0)} · dl{' '}
          {formatDuration(probe.phases.downloadMs ?? 0)}
        </Text>
      )}
    </Text>
  );
}
