import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { IconSelectionControls } from 'src/components/ItemControls/IconSelectionControls/IconSelectionControls';
import { NodeControls } from './NodeControls/NodeControls';
import { ConnectorControls } from './ConnectorControls/ConnectorControls';
import { TextBoxControls } from './TextBoxControls/TextBoxControls';
import { RectangleControls } from './RectangleControls/RectangleControls';

export const ItemControlsManager = () => {
  const itemControls = useUiStateStore((state) => {
    return state.itemControls;
  });
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const selectedItemId =
    itemControls && 'id' in itemControls ? itemControls.id : null;

  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
  }, [selectedItemId, itemControls?.type]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragRef.current) return;

    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;

    setDragOffset({
      x: dragRef.current.originX + deltaX,
      y: dragRef.current.originY + deltaY
    });
  }, []);

  const stopDragging = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', stopDragging);
  }, [handleMouseMove]);

  const startDragging = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (itemControls?.type !== 'ITEM') return;

      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: dragOffset.x,
        originY: dragOffset.y
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopDragging);
    },
    [dragOffset.x, dragOffset.y, handleMouseMove, itemControls?.type, stopDragging]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [handleMouseMove, stopDragging]);

  const Controls = useMemo(() => {
    switch (itemControls?.type) {
      case 'ITEM':
        return <NodeControls key={itemControls.id} id={itemControls.id} />;
      case 'CONNECTOR':
        return <ConnectorControls key={itemControls.id} id={itemControls.id} />;
      case 'TEXTBOX':
        return <TextBoxControls key={itemControls.id} id={itemControls.id} />;
      case 'RECTANGLE':
        return <RectangleControls key={itemControls.id} id={itemControls.id} />;
      case 'ADD_ITEM':
        return <IconSelectionControls />;
      default:
        return null;
    }
  }, [itemControls]);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1400
      }}
    >
      {itemControls?.type === 'ITEM' ? (
        <Box
          sx={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            width: 'min(420px, calc(100vw - 48px))',
            maxHeight: 'min(720px, calc(100vh - 96px))',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 24px 56px rgba(15, 23, 42, 0.26)',
            border: '1px solid rgba(15, 23, 42, 0.12)',
            pointerEvents: 'auto',
            transform: `translate(calc(-50% + ${dragOffset.x}px), calc(-50% + ${dragOffset.y}px))`
          }}
        >
          <Box
            onMouseDown={startDragging}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              cursor: 'move',
              bgcolor: 'rgba(248, 250, 252, 0.98)',
              borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
              userSelect: 'none'
            }}
          >
            <Typography fontWeight={600} color="text.primary">
              Node Details
            </Typography>
            <IconButton
              size="small"
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onClick={() => {
                uiStateActions.setItemControls(null);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              '&::-webkit-scrollbar': {
                width: 8
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(100, 116, 139, 0.35)',
                borderRadius: 8
              }
            }}
          >
            <NodeControls
              key={itemControls.id}
              id={itemControls.id}
              showCloseButton={false}
            />
          </Box>
        </Box>
      ) : (
        Controls
      )}
    </Box>
  );
};
