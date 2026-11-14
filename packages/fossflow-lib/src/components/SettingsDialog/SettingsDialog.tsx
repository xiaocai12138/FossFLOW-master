import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tabs,
  Tab,
  Box
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { HotkeySettings } from '../HotkeySettings/HotkeySettings';
import { PanSettings } from '../PanSettings/PanSettings';
import { ZoomSettings } from '../ZoomSettings/ZoomSettings';
import { ConnectorSettings } from '../ConnectorSettings/ConnectorSettings';
import { IconPackSettings } from '../IconPackSettings/IconPackSettings';
import { IconManagement } from '../IconManagement/IconManagement';
import {
  LanguageSettings,
  LanguageOption
} from './LanguageSettings';
import { useTranslation, useLocale } from 'src/stores/localeStore';

export interface SettingsDialogProps {
  iconPackManager?: {
    lazyLoadingEnabled: boolean;
    onToggleLazyLoading: (enabled: boolean) => void;
    packInfo: Array<{
      name: string;
      displayName: string;
      loaded: boolean;
      loading: boolean;
      error: string | null;
      iconCount: number;
    }>;
    enabledPacks: string[];
    onTogglePack: (packName: string, enabled: boolean) => void;
  };
  /** 当前界面语言代码，例如 zh-CN */
  language?: string;
  /** 可选语言列表，由宿主应用提供 */
  supportedLanguages?: LanguageOption[];
  /** 切换语言回调 */
  onLanguageChange?: (lang: string) => void;
}

export const SettingsDialog = ({
  iconPackManager,
  language,
  supportedLanguages,
  onLanguageChange
}: SettingsDialogProps) => {
  const dialog = useUiStateStore((state) => state.dialog);
  const setDialog = useUiStateStore((state) => state.actions.setDialog);
  const [tabValue, setTabValue] = useState(0);
  const { t } = useTranslation();
  const locale = useLocale();

  const isOpen = dialog === 'SETTINGS';

  const handleClose = () => {
    setDialog(null);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // 页签下标集中管理，避免新增页签时错位
  const tabs = [
    {
      key: 'language',
      label: locale.settings.language?.title ?? 'Language'
    },
    { key: 'hotkeys', label: t('settings.hotkeys.title') },
    { key: 'pan', label: t('settings.pan.title') },
    {
      key: 'zoom',
      label: locale.settings.zoom.title ?? 'Zoom'
    },
    { key: 'connector', label: t('settings.connector.title') },
    ...(iconPackManager
      ? [{ key: 'iconPacks', label: t('settings.iconPacks.title') }]
      : []),
    {
      key: 'iconManagement',
      label: locale.settings.iconManagement?.title ?? 'Icons'
    }
  ];

  const activeKey = tabs[tabValue]?.key ?? tabs[0].key;

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('mainMenu.settings')}
        <IconButton
          aria-label={t('helpDialog.close')}
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500]
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {tabs.map((tab) => (
            <Tab key={tab.key} label={tab.label} />
          ))}
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {activeKey === 'language' && (
            <LanguageSettings
              language={language}
              supportedLanguages={supportedLanguages}
              onLanguageChange={onLanguageChange}
            />
          )}
          {activeKey === 'hotkeys' && <HotkeySettings />}
          {activeKey === 'pan' && <PanSettings />}
          {activeKey === 'zoom' && <ZoomSettings />}
          {activeKey === 'connector' && <ConnectorSettings />}
          {activeKey === 'iconPacks' && iconPackManager && (
            <IconPackSettings
              lazyLoadingEnabled={iconPackManager.lazyLoadingEnabled}
              onToggleLazyLoading={iconPackManager.onToggleLazyLoading}
              packInfo={iconPackManager.packInfo}
              enabledPacks={iconPackManager.enabledPacks}
              onTogglePack={iconPackManager.onTogglePack}
            />
          )}
          {activeKey === 'iconManagement' && <IconManagement />}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('helpDialog.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
