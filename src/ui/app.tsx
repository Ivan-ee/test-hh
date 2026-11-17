import { performance } from 'node:perf_hooks';
import { useEffect, useRef, useState } from 'react';
import { Box, Static, Text, render, useApp } from 'ink';
import { EXIT_CODES } from '../core/domain.js';
import type { ProbeResult, RunResult, TargetInfo } from '../core/domain.js';
import { formatBytes, formatDuration, formatRate } from '../core/format.js';
import { runSeries } from '../core/run.js';
import { preflight } from '../core/validate.js';
import { ProbeRow } from './probe-row.js';
import { sparkline } from './sparkline.js';
import { Spinner } from './spinner.js';
import { Summary } from './summary.js';

export interface RunConfig {
  target: string;
  requests: number;
  timeoutMs: number;
}

type StaticItem =
  | { kind: 'header'; target: string }
  | { kind: 'meta'; info: TargetInfo; requests: number; timeoutMs: number }
  | { kind: 'probe'; probe: ProbeResult }
  | { kind: 'summary'; result: RunResult }
  | { kind: 'error'; error: string };

interface LiveState {
  index: number;
  bytes: number;
  instantBps: number;
  startedAt: number;
}

type Stage = 'preflight' | 'running' | 'done' | 'error';

/** TUI mode: static zone accumulates finished output, the live zone redraws at ~10 Hz. */
export function runApp(config: RunConfig): Promise<void> {
  return new Promise((resolve) => {
    let exitCode: number = EXIT_CODES.ok;
    const handleExitCode = (code: number) => {
      exitCode = code;
    };
    const instance = render(<RunApp config={config} onExitCode={handleExitCode} />);
    instance.waitUntilExit().then(() => {
      process.exitCode = exitCode;
      resolve();
    });
  });
}

function RunApp({ config, onExitCode }: { config: RunConfig; onExitCode: (code: number) => void }) {
  const { exit } = useApp();
  const [stage, setStage] = useState<Stage>('preflight');
  const [items, setItems] = useState<StaticItem[]>([{ kind: 'header', target: config.target }]);
  const [live, setLive] = useState<(LiveState & { elapsedMs: number }) | null>(null);
  const [spark, setSpark] = useState<number[]>([]);

  // Ticks mutate refs; a 100 ms flush turns them into renders (≈ the live cadence).
  const liveRef = useRef<LiveState | null>(null);
  const sparkRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    let flushTimer: NodeJS.Timeout | null = null;

    const startFlush = () => {
      flushTimer = setInterval(() => {
        const current = liveRef.current;
        if (current) {
          setLive({ ...current, elapsedMs: performance.now() - current.startedAt });
          setSpark([...sparkRef.current]);
        }
      }, 100);
    };
    const stopFlush = () => {
      if (flushTimer) clearInterval(flushTimer);
      flushTimer = null;
    };

    const work = async () => {
      const pf = await preflight(config.target);
      if (cancelled) return;
      if (!pf.ok) {
        setItems((prev) => [...prev, { kind: 'error', error: pf.error }]);
        setStage('error');
        onExitCode(EXIT_CODES.usage);
        return;
      }

      setItems((prev) => [
        ...prev,
        { kind: 'meta', info: pf.info, requests: config.requests, timeoutMs: config.timeoutMs },
      ]);
      setStage('running');
      startFlush();

      const result = await runSeries(
        {
          target: pf.info.url,
          requests: config.requests,
          timeoutMs: config.timeoutMs,
          targetInfo: pf.info,
        },
        {
          onProbeStart: (index) => {
            liveRef.current = { index, bytes: 0, instantBps: 0, startedAt: performance.now() };
            sparkRef.current = [];
          },
          onTick: (_index, bytes, instantBps) => {
            const current = liveRef.current;
            if (!current) return;
            // Exponential smoothing so the displayed number does not twitch between chunks.
            const smoothed =
              current.instantBps === 0 ? instantBps : current.instantBps * 0.7 + instantBps * 0.3;
            current.bytes = bytes;
            current.instantBps = smoothed;
            sparkRef.current = [...sparkRef.current.slice(-63), smoothed];
          },
          onProbeDone: (probeResult) => {
            setItems((prev) => [...prev, { kind: 'probe', probe: probeResult }]);
            liveRef.current = null;
          },
        },
      );

      stopFlush();
      if (cancelled) return;
      setLive(null);
      setItems((prev) => [...prev, { kind: 'summary', result }]);
      setStage('done');
      onExitCode(result.stats.successful > 0 ? EXIT_CODES.ok : EXIT_CODES.failed);
    };

    work().catch((err: unknown) => {
      stopFlush();
      if (cancelled) return;
      setLive(null);
      const message = err instanceof Error ? err.message : String(err);
      setItems((prev) => [...prev, { kind: 'error', error: message }]);
      setStage('error');
      onExitCode(EXIT_CODES.failed);
    });

    return () => {
      cancelled = true;
      stopFlush();
    };
  }, [config, onExitCode]);

  // Let the static zone paint the final items, then leave — only static output survives exit.
  useEffect(() => {
    if (stage === 'done' || stage === 'error') {
      const timer = setTimeout(() => exit(), 150);
      return () => clearTimeout(timer);
    }
  }, [stage, exit]);

  const meta = items.find(
    (item): item is Extract<StaticItem, { kind: 'meta' }> => item.kind === 'meta',
  );

  return (
    <>
      <Static items={items}>
        {(item) => {
          switch (item.kind) {
            case 'header':
              return (
                <Box flexDirection="column">
                  <Text>
                    <Text bold color="cyan">
                      ⚡ netspeed
                    </Text>{' '}
                    <Text dimColor>— download speed probe</Text>
                  </Text>
                  <Text>
                    Target: <Text color="blue">{item.target}</Text>
                  </Text>
                </Box>
              );
            case 'meta': {
              const parts = [
                item.info.contentType,
                item.info.contentLength === null ? null : formatBytes(item.info.contentLength),
              ].filter((part) => part !== null);
              return (
                <Text dimColor>
                  Content: {parts.length > 0 ? parts.join(' · ') : 'unknown'} · requests:{' '}
                  {item.requests} · timeout:{' '}
                  {item.timeoutMs > 0 ? formatDuration(item.timeoutMs) : 'off'}
                </Text>
              );
            }
            case 'probe':
              return <ProbeRow probe={item.probe} />;
            case 'summary':
              return <Summary result={item.result} />;
            case 'error':
              return (
                <Box borderStyle="round" borderColor="red" paddingX={1} marginTop={1}>
                  <Text color="red">✗ {item.error}</Text>
                </Box>
              );
            default:
              return null;
          }
        }}
      </Static>

      {stage === 'preflight' && <Spinner label="Checking target…" />}
      {stage === 'running' && live && (
        <LiveZone
          live={live}
          spark={spark}
          total={config.requests}
          knownLength={meta?.info.contentLength ?? null}
        />
      )}
    </>
  );
}

function LiveZone({
  live,
  spark,
  total,
  knownLength,
}: {
  live: LiveState & { elapsedMs: number };
  spark: number[];
  total: number;
  knownLength: number | null;
}) {
  const width = 24;
  const fraction =
    knownLength !== null && knownLength > 0 ? Math.min(1, live.bytes / knownLength) : null;
  const filled = fraction === null ? null : Math.round(fraction * width);
  const bar = filled === null ? null : '█'.repeat(filled) + '░'.repeat(width - filled);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Spinner label={`Request ${live.index + 1} of ${total}`} />
      <Text>
        {'  '}
        {bar !== null ? <Text color="cyan">{bar}</Text> : null} {formatBytes(live.bytes)}
        {knownLength !== null ? ` / ${formatBytes(knownLength)}` : ''}
      </Text>
      <Text>
        {'  '}
        <Text color="green">{formatRate(live.instantBps)}</Text>{' '}
        <Text dimColor>{sparkline(spark)}</Text>{' '}
        <Text dimColor>elapsed {formatDuration(live.elapsedMs)}</Text>
      </Text>
    </Box>
  );
}
