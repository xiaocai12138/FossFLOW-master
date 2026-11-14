import React, { useState, useCallback, useMemo } from 'react';
import { Menu, Typography, Divider, Card, Box, Button } from '@mui/material';
import {
  Menu as MenuIcon,
  GitHub as GitHubIcon,
  DataObject as ExportJsonIcon,
  ImageOutlined as ExportImageIcon,
  FolderOpen as FolderOpenIcon,
  DeleteOutline as DeleteOutlineIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Settings as SettingsIcon,

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
  const { undo, redo, canUndo, canRedo, clearHistory } = useHistory();

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

  const handleUndo = useCallback(() => {
    undo();
    uiStateActions.setIsMainMenuOpen(false);
  }, [undo, uiStateActions]);

  const handleRedo = useCallback(() => {
    redo();
    uiStateActions.setIsMainMenuOpen(false);
  }, [redo, uiStateActions]);

  const onOpenSettings = useCallback(() => {
    uiStateActions.setIsMainMenuOpen(false);
    uiStateActions.setDialog(DialogTypeEnum.SETTINGS);
  }, [uiStateActions]);




  const sectionVisibility = useMemo(() => {
    return {
      actions: Boolean(
        mainMenuOptions.find((opt) => {
          return opt.includes('ACTION') || opt.includes('EXPORT');
        })
      ),
      links: Boolean(
        mainMenuOptions.find((opt) => {
          return opt.includes('LINK');
        })
      ),
      version: Boolean(mainMenuOptions.includes('VERSION')),
      custom: Boolean(
        customMainMenu &&
          (customMainMenu.actions.length > 0 ||
            customMainMenu.languageControl ||
            customMainMenu.iconSourceControl ||
            customMainMenu.status)
      )
    };
  }, [customMainMenu, mainMenuOptions]);

  if (mainMenuOptions.length === 0 && !sectionVisibility.custom) {
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
          uiStateActions.setIsMainMenuOpen(false);
        }}
        elevation={0}
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
        <Card sx={{ py: 1 }}>
          {/* Undo/Redo Section */}
          <MenuItem
            onClick={handleUndo}
            Icon={<UndoIcon />}
            disabled={!canUndo}
          >
            {t('undo')}
          </MenuItem>

          <MenuItem
            onClick={handleRedo}
            Icon={<RedoIcon />}
            disabled={!canRedo}
          >
            {t('redo')}
          </MenuItem>


          {(canUndo || canRedo) && sectionVisibility.actions && <Divider />}

          {/* File Actions */}
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

          {sectionVisibility.custom && (
            <>
              <Divider />
              <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {customMainMenu?.actions.map((action) => (
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

          <Divider />

          <MenuItem onClick={onOpenSettings} Icon={<SettingsIcon />}>
            {t('settings')}
          </MenuItem>

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
    </UiElement>
  );
};
