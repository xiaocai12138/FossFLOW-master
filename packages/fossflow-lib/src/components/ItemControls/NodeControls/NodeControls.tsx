import React, { useState, useCallback, useEffect } from 'react';
import { Box, Stack, Button, Typography } from '@mui/material';
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { useIcon } from 'src/hooks/useIcon';
import { useScene } from 'src/hooks/useScene';
import { useViewItem } from 'src/hooks/useViewItem';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelItem } from 'src/hooks/useModelItem';
import { ControlsContainer } from '../components/ControlsContainer';
import { NodeSettings } from './NodeSettings/NodeSettings';
import { Section } from '../components/Section';
import { QuickIconSelector } from './QuickIconSelector';

interface Props {
  id: string;
  /** 由父级控制图标库是否展开，展开时横向加宽而不是替换当前内容。 */
  iconLibraryOpen?: boolean;
  onIconLibraryOpenChange?: (open: boolean) => void;
}

const ModeOptions = {
  SETTINGS: 'SETTINGS',
  CHANGE_ICON: 'CHANGE_ICON'
} as const;

type Mode = keyof typeof ModeOptions;

export const NodeControls = ({
  id,
  iconLibraryOpen,
  onIconLibraryOpenChange
}: Props) => {
  const [internalMode, setInternalMode] = useState<Mode>('SETTINGS');
  const isControlled = typeof iconLibraryOpen === 'boolean';
  const mode: Mode = isControlled
    ? iconLibraryOpen
      ? 'CHANGE_ICON'
      : 'SETTINGS'
    : internalMode;
  const { updateModelItem, updateViewItem, deleteViewItem } = useScene();
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const viewItem = useViewItem(id);
  const modelItem = useModelItem(id);
  const { icon } = useIcon(modelItem?.icon || '');

  const onSwitchMode = useCallback(
    (newMode: Mode) => {
      setInternalMode(newMode);
      onIconLibraryOpenChange?.(newMode === 'CHANGE_ICON');
    },
    [onIconLibraryOpenChange]
  );

  // Listen for quick icon change event (triggered by 'i' hotkey)
  useEffect(() => {
    const handleQuickIconChange = () => {
      onSwitchMode('CHANGE_ICON');
    };

    window.addEventListener('quickIconChange', handleQuickIconChange);
    return () => {
      window.removeEventListener('quickIconChange', handleQuickIconChange);
    };
  }, [onSwitchMode]);

  // If items don't exist, return null (component will unmount)
  if (!viewItem || !modelItem) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        height: '100%',
        minHeight: 0
      }}
    >
      <Box sx={{ flex: '1 1 auto', minWidth: 0, overflowY: 'auto' }}>
        <ControlsContainer>
          <Box
            sx={{
              bgcolor: (theme) => {
                return theme.customVars.customPalette.diagramBg;
              },
              position: 'relative'
            }}
          >
            <Section sx={{ py: 2 }}>
              <Stack
                direction="row"
                spacing={2}
                alignItems="flex-end"
                justifyContent="space-between"
              >
                <Box
                  component="img"
                  src={icon.url}
                  sx={{ width: 70, height: 70 }}
                />
                <Button
                  endIcon={
                    <ChevronRightIcon
                      sx={{
                        transform:
                          mode === 'CHANGE_ICON'
                            ? 'rotate(180deg)'
                            : 'none',
                        transition: 'transform 200ms ease'
                      }}
                    />
                  }
                  onClick={() => {
                    onSwitchMode(
                      mode === 'CHANGE_ICON' ? 'SETTINGS' : 'CHANGE_ICON'
                    );
                  }}
                  variant="text"
                  color={mode === 'CHANGE_ICON' ? 'secondary' : 'primary'}
                >
                  {mode === 'CHANGE_ICON' ? '收起图标库' : '更新图标'}
                </Button>
              </Stack>
            </Section>
          </Box>

          {/* 节点设置始终可见，不再被图标选择替换 */}
          <NodeSettings
            key={viewItem.id}
            node={viewItem}
            onModelItemUpdated={(updates) => {
              updateModelItem(viewItem.id, updates);
            }}
            onViewItemUpdated={(updates) => {
              updateViewItem(viewItem.id, updates);
            }}
            onDeleted={() => {
              uiStateActions.setItemControls(null);
              deleteViewItem(viewItem.id);
            }}
          />
        </ControlsContainer>
      </Box>

      {mode === 'CHANGE_ICON' && (
        <Box
          sx={{
            flex: '0 0 320px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid rgba(15, 23, 42, 0.08)',
            bgcolor: 'rgba(248, 250, 252, 0.72)'
          }}
        >
          {/* 仅保留标题，关闭由「收起图标库」承担 */}
          <Box
            sx={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              pl: 2,
              pr: 5,
              py: 1,
              borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
              bgcolor: '#f8fafc'
            }}
          >
            <Typography
              sx={{ fontSize: '11.5px', fontWeight: 700, color: 'text.secondary' }}
            >
              图标库
            </Typography>
          </Box>

          <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            <QuickIconSelector
              currentIconId={modelItem.icon}
              onIconSelected={(_icon) => {
                updateModelItem(viewItem.id, { icon: _icon.id });
              }}
              onClose={() => {
                onSwitchMode('SETTINGS');
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};
