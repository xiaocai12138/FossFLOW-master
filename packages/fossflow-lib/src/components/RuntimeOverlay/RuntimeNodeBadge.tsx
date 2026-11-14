import React from 'react';
import { Box } from '@mui/material';
import { RuntimeNodeStatus } from 'src/types';
import { getRuntimeStatusColor } from 'src/utils';
import 'src/styles/runtime.css';

interface Props {
  status: RuntimeNodeStatus;
  isFocused?: boolean;
  /** Host provided localised label; falls back to the built-in English one. */
  label?: string;
}

/**
 * Compact health chip. Rendered inline next to the node name so status lives
 * with the label instead of floating over the icon.
 */
export const RuntimeNodeBadge = ({ status, isFocused, label }: Props) => {
  const color = getRuntimeStatusColor(status);

  if (!color) return null;

  return (
    <Box
      component="span"
      className={[
        'fossflow-runtime-badge',
        `fossflow-runtime-badge-${status.toLowerCase()}`,
        isFocused ? 'is-focused' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      sx={{
        borderColor: color.main,
        color: color.main
      }}
    >
      <span
        className="fossflow-runtime-badge-dot"
        style={{ backgroundColor: color.main }}
      />
      {label ?? color.label}
    </Box>
  );
};
