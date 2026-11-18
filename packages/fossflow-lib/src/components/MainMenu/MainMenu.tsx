import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Menu,
  MenuItem as MuiMenuItem,
  Typography,
  Divider,
  Card,
  Box,
  Button
} from '@mui/material';
import {
  Menu as MenuIcon,
  GitHub as GitHubIcon,
  DataObject as ExportJsonIcon,
  ImageOutlined as ExportImageIcon,
  FolderOpen as FolderOpenIcon,
  DeleteOutline as DeleteOutlineIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { UiElement } from 'src/components/UiElement/UiElement';
import { IconButton } from 'src/components/IconButton/IconButton';
import { useUiStateStore } from 'src/stores/uiStateStore';
import {
  exportAsJSON,
  exportAsCompactJSON,
  loadAvailableIcons,
  transformFromCompactFormat
} from 'src/utils/exportOptions';
import { modelFromModelStore } from 'src/utils';
import { useInitialDataManager } from 'src/hooks/useInitialDataManager';
import { useModelStore } from 'src/stores/modelStore';
import { useHistory } from 'src/hooks/useHistory';
import { DialogTypeEnum } from 'src/types/ui';
import { MenuItem } from './MenuItem';
import { useTranslation } from 'src/stores/localeStore';

export const MainMenu = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [groupAnchorPosition, setGroupAnchorPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  /** 一级菜单项元素：打开二级菜单后按它的最新位置重新对齐 */
  const groupTriggerRef = useRef<HTMLElement | null>(null);
  /** 一级菜单面板：打开后把焦点送进第一个菜单项，方向键才能接管导航 */
  const mainMenuPaperRef = useRef<HTMLDivElement | null>(null);
  const model = useModelStore((state) => {
    return modelFromModelStore(state);
  });
  const isMainMenuOpen = useUiStateStore((state) => {
    return state.isMainMenuOpen;
  });
  const mainMenuOptions = useUiStateStore((state) => {
    return state.mainMenuOptions;
  });
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const customMainMenu = useUiStateStore((state) => {
    return state.customMainMenu;
  });
  const initialDataManager = useInitialDataManager();
  const { clearHistory } = useHistory();
  const fileActions = customMainMenu?.actions.filter((action) => action.section === 'file');
  const customActions = customMainMenu?.actions.filter((action) => action.section !== 'file');

  const { t } = useTranslation('mainMenu');

  const onToggleMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget);
      uiStateActions.setIsMainMenuOpen(true);
    },
    [uiStateActions]
  );

  const gotoUrl = useCallback((url: string) => {
    window.open(url, '_blank');
  }, []);

  /** 关闭二级菜单并回到一级菜单，用于选择叶子动作后收拢两层菜单 */
  /**
   * 自定义菜单区包含原生 Button/select 与分组入口，MUI MenuList 的方向键
   * 只会遍历原生 menuitem。这里在 window 捕获阶段拦截 Tab，在菜单内部循环
   * 焦点，保证键盘可以到达「APM 架构」等自定义入口而不是跳出菜单。
   */
  useEffect(() => {
    if (!isMainMenuOpen) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const container = mainMenuPaperRef.current;

      if (!container) return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [role="menuitem"], select, input'
        )
      ).filter(
        (element) =>
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-disabled') !== 'true'
      );

      if (focusables.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      const index = focusables.indexOf(document.activeElement as HTMLElement);
      const offset = event.shiftKey ? -1 : 1;
      const next =
        index === -1
          ? focusables[0]
          : focusables[(index + offset + focusables.length) % focusables.length];

      next.focus();
    };

    window.addEventListener('keydown', handler, true);

    return () => window.removeEventListener('keydown', handler, true);
  }, [isMainMenuOpen]);

  const closeGroupMenu = useCallback(() => {
    setOpenGroupId(null);
    setGroupAnchorPosition(null);
    groupTriggerRef.current = null;
  }, []);

  /**
   * 打开一级菜单后聚焦第一个菜单项。
   *
   * MUI 默认可能把焦点停在 Paper 上，此时方向键不会进入菜单项；
   * 显式聚焦后 ArrowUp/ArrowDown 才能按 MenuList 语义移动。
   */
  useEffect(() => {
    if (!isMainMenuOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const firstItem = mainMenuPaperRef.current?.querySelector(
        '[role="menuitem"]'
      ) as HTMLElement | null;

      firstItem?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isMainMenuOpen]);

  /**
   * 一级菜单点击后可能因焦点/重渲染改变滚动位置，导致刚记录的位置失效。
   * 打开后下一帧按元素最新 rect 再对齐一次。
   */
  useEffect(() => {
    if (!openGroupId) return;

    const alignToTrigger = () => {
      const element = groupTriggerRef.current;

      if (!element) return;

      const rect = element.getBoundingClientRect();

      setGroupAnchorPosition({ top: rect.top, left: rect.right });
    };

    const frame = window.requestAnimationFrame(alignToTrigger);
    // 一级菜单的展开动画会改变宽度与位置，动画结束后再对齐一次
    const timer = window.setTimeout(alignToTrigger, 250);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [openGroupId]);

  const closeAllMenus = useCallback(() => {
    closeGroupMenu();
    uiStateActions.setIsMainMenuOpen(false);
  }, [closeGroupMenu, uiStateActions]);

  const { load } = initialDataManager;

  const onOpenModel = useCallback(async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';

    fileInput.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];

      if (!file) {
        throw new Error('No file selected');
      }

      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        const rawData = JSON.parse(e.target?.result as string);
        let modelData = rawData;

        // Check format and transform if needed
        if (rawData._?.f === 'compact') {
          await loadAvailableIcons();
          modelData = transformFromCompactFormat(rawData);
        }

        load(modelData);
        clearHistory(); // Clear history when loading new model
      };
      fileReader.readAsText(file);

      uiStateActions.resetUiState();
    };

    await fileInput.click();
    uiStateActions.setIsMainMenuOpen(false);
  }, [uiStateActions, load, clearHistory]);

  const onExportAsJSON = useCallback(async () => {
    exportAsJSON(model);
    uiStateActions.setIsMainMenuOpen(false);
  }, [model, uiStateActions]);

  const onExportAsCompactJSON = useCallback(async () => {
    exportAsCompactJSON(model);
    uiStateActions.setIsMainMenuOpen(false);
  }, [model, uiStateActions]);

  const onExportAsImage = useCallback(() => {
    uiStateActions.setIsMainMenuOpen(false);
    uiStateActions.setDialog(DialogTypeEnum.EXPORT_IMAGE);
  }, [uiStateActions]);

  const { clear } = initialDataManager;

  const onClearCanvas = useCallback(() => {
    clear();
    clearHistory(); // Clear history when clearing canvas
    uiStateActions.setIsMainMenuOpen(false);
  }, [uiStateActions, clear, clearHistory]);

  const onOpenSettings = useCallback(() => {
    uiStateActions.setIsMainMenuOpen(false);
    uiStateActions.setDialog(DialogTypeEnum.SETTINGS);
  }, [uiStateActions]);

  const sectionVisibility = {
    links: Boolean(
      mainMenuOptions.find((opt) => {
        return opt.includes('LINK');
      })
    ),
    version: Boolean(mainMenuOptions.includes('VERSION')),
    custom: Boolean(
      customMainMenu &&
        ((customActions?.length ?? 0) > 0 ||
          (customMainMenu.groups?.length ?? 0) > 0 ||
          customMainMenu.languageControl ||
          customMainMenu.iconSourceControl ||
          customMainMenu.status)
    )
  };

  if (mainMenuOptions.length === 0 && !fileActions?.length && !sectionVisibility.custom) {
    return null;
  }

  const getActionStyles = (tone?: 'default' | 'primary' | 'success' | 'accent') => {
    switch (tone) {
      case 'primary':
        return {
          backgroundColor: '#eff6ff',
          borderColor: 'rgba(59, 130, 246, 0.24)',
          color: '#1d4ed8'
        };
      case 'success':
        return {
          backgroundColor: '#ecfdf5',
          borderColor: 'rgba(16, 185, 129, 0.22)',
          color: '#047857'
        };
      case 'accent':
        return {
          backgroundColor: '#f0f9ff',
          borderColor: 'rgba(14, 165, 233, 0.24)',
          color: '#0369a1'
        };
      default:
        return {
          backgroundColor: '#ffffff',
          borderColor: 'rgba(18, 18, 18, 0.08)',
          color: '#111827'
        };
    }
  };

  return (
    <UiElement>
      <IconButton
        Icon={<MenuIcon />}
        name="Main menu"
        onClick={onToggleMenu}
        isActive={isMainMenuOpen}
      />

      <Menu
        anchorEl={anchorEl}
        open={isMainMenuOpen}
        onClose={() => {
          closeGroupMenu();
          uiStateActions.setIsMainMenuOpen(false);
        }}
        elevation={0}
        disableRestoreFocus
        sx={{
          mt: 2
        }}
        MenuListProps={{
          sx: {
            minWidth: '250px',
            py: 0
          }
        }}
      >
        <Card ref={mainMenuPaperRef} sx={{ py: 1 }}>
          {fileActions?.map((action) => (
            <MenuItem
              key={action.id}
              disabled={action.disabled}
              onClick={() => {
                closeAllMenus();
                action.onClick();
              }}
            >
              {action.label}
            </MenuItem>
          ))}
          {mainMenuOptions.includes('ACTION.OPEN') && (
            <MenuItem onClick={onOpenModel} Icon={<FolderOpenIcon />}>
              {t('open')}
            </MenuItem>
          )}

          {mainMenuOptions.includes('EXPORT.JSON') && (
            <MenuItem onClick={onExportAsJSON} Icon={<ExportJsonIcon />}>
              {t('exportJson')}
            </MenuItem>
          )}

          {mainMenuOptions.includes('EXPORT.JSON') && (
            <MenuItem onClick={onExportAsCompactJSON} Icon={<ExportJsonIcon />}>
              {t('exportCompactJson')}
            </MenuItem>
          )}

          {mainMenuOptions.includes('EXPORT.PNG') && (
            <MenuItem onClick={onExportAsImage} Icon={<ExportImageIcon />}>
              {t('exportImage')}
            </MenuItem>
          )}

          {mainMenuOptions.includes('ACTION.CLEAR_CANVAS') && (
            <MenuItem onClick={onClearCanvas} Icon={<DeleteOutlineIcon />}>
              {t('clearCanvas')}
            </MenuItem>
          )}

          <MenuItem onClick={onOpenSettings} Icon={<SettingsIcon />}>
            {t('settings')}
          </MenuItem>

          {sectionVisibility.custom && (
            <>
              <Divider />
              <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {customActions?.map((action) => (
                  <Button
                    key={action.id}
                    fullWidth
                    variant="outlined"
                    disabled={action.disabled}
                    onClick={() => {
                      action.onClick();
                      uiStateActions.setIsMainMenuOpen(false);
                    }}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      borderRadius: 2,
                      px: 1.5,
                      py: 1,
                      fontSize: 14,
                      fontWeight: 500,
                      ...getActionStyles(action.tone)
                    }}
                  >
                    {action.label}
                  </Button>
                ))}

                {customMainMenu?.groups?.map((group) => (
                  <MuiMenuItem
                    key={group.id}
                    tabIndex={0}
                    aria-haspopup="menu"
                    aria-expanded={openGroupId === group.id}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();

                      groupTriggerRef.current = event.currentTarget;
                      // 记录点击瞬间的位置，下一帧再按元素最新 rect 校正
                      setGroupAnchorPosition({
                        top: rect.top,
                        left: rect.right
                      });
                      setOpenGroupId(group.id);
                    }}
                    sx={{
                      borderRadius: 2,
                      px: 1.5,
                      py: 1,
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#111827',
                      border: '1px solid rgba(18, 18, 18, 0.08)',
                      backgroundColor: '#ffffff',
                      '&:hover': {
                        backgroundColor: '#f0f9ff',
                        color: '#0369a1'
                      }
                    }}
                  >
                    {group.label}
                  </MuiMenuItem>
                ))}

                {customMainMenu?.languageControl && (
                  <Box sx={{ pt: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                      }}
                    >
                      Language
                    </Typography>
                    <Box sx={{ mt: 0.75 }}>{customMainMenu.languageControl}</Box>
                  </Box>
                )}

                {customMainMenu?.iconSourceControl && (
                  <Box sx={{ pt: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                      }}
                    >
                      Icon Source
                    </Typography>
                    <Box sx={{ mt: 0.75 }}>{customMainMenu.iconSourceControl}</Box>
                  </Box>
                )}

                {customMainMenu?.status && (
                  <Box
                    sx={{
                      mt: 0.5,
                      p: 1.25,
                      borderRadius: 2,
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827' }}>
                      {customMainMenu.status.title}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600, color: '#f59e0b' }}>
                      {customMainMenu.status.meta}
                    </Typography>
                    {customMainMenu.status.note && (
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: '#64748b' }}>
                        {customMainMenu.status.note}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </>
          )}

          {sectionVisibility.links && (
            <>
              <Divider />

              {mainMenuOptions.includes('LINK.GITHUB') && (
                <MenuItem
                  onClick={() => {
                    return gotoUrl(`${REPOSITORY_URL}`);
                  }}
                  Icon={<GitHubIcon />}
                >
                  {t('gitHub')}
                </MenuItem>
              )}
            </>
          )}

          {sectionVisibility.version && (
            <>
              <Divider />

              {mainMenuOptions.includes('VERSION') && (
                <MenuItem>
                  <Typography variant="body2" color="text.secondary">
                    FossFLOW v{PACKAGE_VERSION}
                  </Typography>
                </MenuItem>
              )}
            </>
          )}
        </Card>
      </Menu>

      {customMainMenu?.groups?.map((group) => (
        <Menu
          key={group.id}
          anchorReference="anchorPosition"
          anchorPosition={groupAnchorPosition ?? undefined}
          open={openGroupId === group.id && Boolean(groupAnchorPosition)}
          onClose={closeGroupMenu}
          elevation={4}
          // ArcMap 式二级菜单：从一级项右侧展开，而不是叠在一级菜单上面
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          sx={{ ml: 2 }}
          MenuListProps={{
            sx: {
              minWidth: '200px',
              py: 0.5
            }
          }}
        >
          {group.actions.map((action) => (
            <MuiMenuItem
              key={action.id}
              disabled={action.disabled}
              onClick={() => {
                action.onClick();
                closeAllMenus();
              }}
              sx={{
                fontSize: 14,
                fontWeight: 500,
                px: 2,
                py: 1
              }}
            >
              {action.label}
            </MuiMenuItem>
          ))}
        </Menu>
      ))}
    </UiElement>
  );
};
