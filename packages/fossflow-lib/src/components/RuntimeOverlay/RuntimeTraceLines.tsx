import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { UNPROJECTED_TILE_SIZE } from 'src/config';
import { Svg } from 'src/components/Svg/Svg';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import { useScene } from 'src/hooks/useScene';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { TRACE_HIGHLIGHT_COLOR } from 'src/utils';
import 'src/styles/runtime.css';

const DRAW_OFFSET = UNPROJECTED_TILE_SIZE / 2;

export const RuntimeTraceLines = () => {
  const { connectors } = useScene();
  const runtimeOverlay = useUiStateStore((state) => {
    return state.runtimeOverlay;
  });

  const highlighted = useMemo(() => {
    if (!runtimeOverlay) return [];

    return connectors.flatMap((connector) => {
      const reveal = runtimeOverlay.connectorReveal[connector.id];

      if (reveal === undefined || reveal <= 0) return [];

      const tiles = connector.path?.tiles ?? [];

      if (tiles.length < 2) return [];

      return [{ connector, tiles, reveal }];
    });
  }, [connectors, runtimeOverlay]);

  if (!runtimeOverlay || highlighted.length === 0) return null;

  return (
    <>
      {highlighted.map(({ connector, tiles, reveal }) => {
        const from = connector.path.rectangle.from;
        const to = connector.path.rectangle.to;

        return (
          <TraceLine
            key={connector.id}
            tiles={tiles}
            reveal={reveal}
            from={from}
            to={to}
            width={connector.width || 10}
          />
        );
      })}
    </>
  );
};

interface TraceLineProps {
  tiles: Array<{ x: number; y: number }>;
  reveal: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  width: number;
}

const TraceLine = ({ tiles, reveal, from, to, width }: TraceLineProps) => {
  const { css, pxSize } = useIsoProjection({ from, to });

  const points = useMemo(() => {
    const visibleCount = Math.max(1, Math.ceil(tiles.length * reveal));

    return tiles
      .slice(0, visibleCount)
      .map((tile) => {
        return `${tile.x * UNPROJECTED_TILE_SIZE + DRAW_OFFSET},${
          tile.y * UNPROJECTED_TILE_SIZE + DRAW_OFFSET
        }`;
      })
      .join(' ');
  }, [tiles, reveal]);

  const strokeWidth = Math.max(3, (UNPROJECTED_TILE_SIZE / 100) * width);

  return (
    <Box style={css} className="fossflow-runtime-trace-line">
      <Svg
        viewboxSize={pxSize}
        style={{ transform: 'scale(-1, 1)' }}
        className="fossflow-runtime-trace-line"
      >
        <polyline
          points={points}
          stroke="rgba(255, 255, 255, 0.9)"
          strokeWidth={strokeWidth * 1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <polyline
          points={points}
          stroke={TRACE_HIGHLIGHT_COLOR}
          strokeWidth={strokeWidth * 1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <polyline
          className="fossflow-runtime-trace-active"
          points={points}
          stroke="#e0f2fe"
          strokeWidth={strokeWidth * 0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Box>
  );
};
