import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon, DragIndicator as DragIcon } from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { IconSelectionControls } from 'src/components/ItemControls/IconSelectionControls/IconSelectionControls';
import { NodeControls } from './NodeControls/NodeControls';
import { ConnectorControls } from './ConnectorControls/ConnectorControls';
import { TextBoxControls } from './TextBoxControls/TextBoxControls';
import { RectangleControls } from './RectangleControls/RectangleControls';

const PANEL_TITLES: Record<string, string> = {
  ITEM: '节点详情',
  CONNECTOR: '连接线设置',
  TEXTBOX: '文本设置',
  RECTANGLE: '区域设置',
  ADD_ITEM: '选择图标'
};

const PANEL_WIDTHS: Record<string, number> = {
  ITEM: 420,
  CONNECTOR: 440,
  TEXTBOX: 460,
  RECTANGLE: 420,
  ADD_ITEM: 600
};

/** 节点面板展开图标库后横向加宽，图标区固定在右侧。 */
const ICON_LIBRARY_WIDTH = 320;

const MARGIN = 8;

/**
 * 图元属性面板：统一的居中可拖动对话框。
 * 不再占用画布侧边空间，关闭后画布立即恢复完整可见。
 */
export const ItemControlsManager = () => {
  const itemControls = useUiStateStore((state) => {
    return state.itemControls;
  });
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isIconLibraryOpen, setIsIconLibraryOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const offsetRef = useRef(offset);

  offsetRef.current = offset;

  const selectedItemId =
    itemControls && 'id' in itemControls ? itemControls.id : null;

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setIsIconLibraryOpen(false);
  }, [selectedItemId, itemControls?.type]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const drag = dragRef.current;

    if (!drag) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const maxLeft = window.innerWidth - drag.width - MARGIN;
    const maxTop = window.innerHeight - drag.height - MARGIN;
    const nextLeft = Math.min(
      Math.max(drag.left + deltaX, MARGIN),
      Math.max(MARGIN, maxLeft)
    );
    const nextTop = Math.min(
      Math.max(drag.top + deltaY, MARGIN),
      Math.max(MARGIN, maxTop)
    );

    setOffset({
      x: drag.originX + (nextLeft - drag.left),
      y: drag.originY + (nextTop - drag.top)
    });
  }, []);

  const stopDragging = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', stopDragging);
  }, [handleMouseMove]);

  const startDragging = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const panel = panelRef.current;

      if (!panel) return;

      const rect = panel.getBoundingClientRect();

      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: offsetRef.current.x,
        originY: offsetRef.current.y,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopDragging);
      event.preventDefault();
    },
    [handleMouseMove, stopDragging]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [handleMouseMove, stopDragging]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      uiStateActions.setItemControls(null);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiStateActions]);

  const Controls = useMemo(() => {
    switch (itemControls?.type) {
      case 'ITEM':
        return (
          <NodeControls
            key={itemControls.id}
            id={itemControls.id}
            iconLibraryOpen={isIconLibraryOpen}
            onIconLibraryOpenChange={setIsIconLibraryOpen}
          />
        );
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
  }, [isIconLibraryOpen, itemControls]);

  if (!itemControls) {
    return null;
  }

  const panelType = itemControls.type;
  const title = PANEL_TITLES[panelType] ?? '属性';
  const baseWidth = PANEL_WIDTHS[panelType] ?? 420;
  const iconLibraryExpanded = panelType === 'ITEM' && isIconLibraryOpen;
  const width = iconLibraryExpanded ? baseWidth + ICON_LIBRARY_WIDTH : baseWidth;
  /**
   * 居中布局下加宽会向两侧均匀扩张，导致左侧表单跳动。
   * 这里补偿半个新增宽度，让左边缘固定、只向右展开。
   * 窄屏空间不足时不做补偿，避免面板被推出视口。
   */
  const expandShift =
    iconLibraryExpanded &&
    typeof window !== 'undefined' &&
    window.innerWidth >= 900
      ? ICON_LIBRARY_WIDTH / 2
      : 0;
  // 图标面板需要从面板拖拽图标到画布，因此不铺遮罩。
  const withBackdrop = panelType !== 'ADD_ITEM';

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      {withBackdrop && (
        <Box
          onMouseDown={() => uiStateActions.setItemControls(null)}
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(15, 23, 42, 0.18)',
            pointerEvents: 'auto'
          }}
        />
      )}

      <Box
        ref={panelRef}
        sx={{
          position: 'relative',
          width: `min(${width}px, calc(100vw - 32px))`,
          maxHeight: 'min(720px, calc(100vh - 80px))',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid rgba(15, 23, 42, 0.12)',
          boxShadow: '0 24px 56px rgba(15, 23, 42, 0.26)',
          pointerEvents: 'auto',
          transform: `translate(${offset.x + expandShift}px, ${offset.y}px)`
        }}
      >
        <Box
          onMouseDown={startDragging}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 2,
            py: 1.25,
            cursor: 'move',
            userSelect: 'none',
            bgcolor: 'rgba(248, 250, 252, 0.98)',
            borderBottom: '1px solid rgba(15, 23, 42, 0.08)'
          }}
        >
          <Typography
            sx={{ fontWeight: 700, fontSize: '13.5px', color: 'text.primary' }}
          >
            {title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DragIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            <IconButton
              aria-label="Close"
              size="small"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => uiStateActions.setItemControls(null)}
              sx={{ ml: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
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
          {Controls}
        </Box>
      </Box>
    </Box>
  );
};
