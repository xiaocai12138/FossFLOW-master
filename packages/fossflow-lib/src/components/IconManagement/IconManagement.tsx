import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  DeleteOutline as DeleteIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  Upload as UploadIcon
} from '@mui/icons-material';
import { Icon } from 'src/types';
import { useModelStore } from 'src/stores/modelStore';
import { useLocale } from 'src/stores/localeStore';
import { generateId } from 'src/utils';
import {
  MIN_ICON_SCALE,
  MAX_ICON_SCALE,
  clampScale,
  decodeSvg,
  encodeSvg,
  isSvgDataUrl
} from './iconCodec';

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

export const IconManagement = () => {
  const locale = useLocale();
  const copy = locale.settings.iconManagement;
  const icons = useModelStore((state) => state.icons);
  const modelActions = useModelStore((state) => state.actions);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftSource, setDraftSource] = useState('');
  const [draftScale, setDraftScale] = useState(1);
  const [draftIsometric, setDraftIsometric] = useState(true);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedIcon = useMemo(
    () => icons.find((icon) => icon.id === selectedId) ?? null,
    [icons, selectedId]
  );

  const filteredIcons = useMemo(() => {
    const keyword = filter.trim().toLowerCase();

    if (!keyword) return icons;

    return icons.filter((icon) => icon.name.toLowerCase().includes(keyword));
  }, [filter, icons]);

  const supportsSource = selectedIcon ? isSvgDataUrl(selectedIcon.url) : false;

  // 选中变化时把详情表单同步到该图标
  useEffect(() => {
    if (!selectedIcon) {
      setDraftName('');
      setDraftSource('');
      setDraftScale(1);
      setDraftIsometric(true);
      return;
    }

    setDraftName(selectedIcon.name);
    setDraftSource(decodeSvg(selectedIcon.url) ?? '');
    setDraftScale(clampScale(selectedIcon.scale ?? 1));
    setDraftIsometric(selectedIcon.isIsometric ?? true);
    setStatus(null);
  }, [selectedIcon]);

  const persistIcons = useCallback(
    (nextIcons: Icon[]) => {
      modelActions.set({ icons: nextIcons });
    },
    [modelActions]
  );

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;

      if (!files || files.length === 0) return;

      const existingNames = new Set(icons.map((icon) => icon.name.toLowerCase()));
      const imported: Icon[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        if (!file.type.includes('svg') && !file.name.toLowerCase().endsWith('.svg')) {
          continue;
        }

        let baseName = file.name.replace(/\.[^/.]+$/, '') || `icon-${index + 1}`;
        let finalName = baseName;
        let counter = 1;

        while (existingNames.has(finalName.toLowerCase())) {
          finalName = `${baseName}_${counter}`;
          counter += 1;
        }

        existingNames.add(finalName.toLowerCase());

        try {
          const url = await readFileAsDataUrl(file);

          imported.push({
            id: generateId(),
            name: finalName,
            url,
            collection: 'imported',
            isIsometric: true,
            scale: 1
          });
        } catch {
          // 单个文件失败不影响其余文件
        }
      }

      if (imported.length > 0) {
        persistIcons([...icons, ...imported]);
        setSelectedId(imported[0].id);
        setStatus({
          tone: 'ok',
          text: `${copy?.applied ?? 'Applied'} · ${imported.length}`
        });
      }

      event.target.value = '';
    },
    [copy?.applied, icons, persistIcons]
  );

  const handleApply = useCallback(() => {
    if (!selectedIcon) return;

    const trimmedName = draftName.trim();

    if (!trimmedName) return;

    let nextUrl = selectedIcon.url;

    if (supportsSource) {
      const candidate = draftSource.trim();

      if (candidate && !/^<svg[\s>]/i.test(candidate)) {
        setStatus({ tone: 'error', text: copy?.invalidSvg ?? 'Invalid SVG' });
        return;
      }

      nextUrl = encodeSvg(candidate);
    }

    const nextIcons = icons.map((icon) => {
      if (icon.id !== selectedIcon.id) return icon;

      return {
        ...icon,
        name: trimmedName,
        url: nextUrl,
        scale: clampScale(draftScale),
        isIsometric: draftIsometric
      };
    });

    persistIcons(nextIcons);
    setStatus({ tone: 'ok', text: copy?.applied ?? 'Applied' });
  }, [
    copy?.applied,
    copy?.invalidSvg,
    draftIsometric,
    draftName,
    draftScale,
    draftSource,
    icons,
    persistIcons,
    selectedIcon,
    supportsSource
  ]);

  const handleDelete = useCallback(() => {
    if (!selectedIcon) return;

    persistIcons(icons.filter((icon) => icon.id !== selectedIcon.id));
    setSelectedId(null);
  }, [icons, persistIcons, selectedIcon]);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(draftSource).catch(() => undefined);
  }, [draftSource]);

  const handleDownload = useCallback(() => {
    if (!selectedIcon) return;

    const blob = new Blob([draftSource], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${draftName || selectedIcon.name}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }, [draftName, draftSource, selectedIcon]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          p: 2,
          borderRadius: 2,
          border: '1px solid rgba(15,23,42,0.08)',
          bgcolor: 'rgba(248,250,252,0.8)'
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
            {copy?.importTitle ?? 'Import icons'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {copy?.importDesc ?? 'Select SVG files to import.'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<UploadIcon />}
          onClick={() => fileInputRef.current?.click()}
        >
          {copy?.selectFiles ?? 'Choose files'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          multiple
          hidden
          onChange={handleImport}
        />
      </Box>

      {status && (
        <Alert severity={status.tone === 'ok' ? 'success' : 'error'}>
          {status.text}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', minHeight: 380 }}>
        <Box
          sx={{
            flex: '0 0 260px',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <Box sx={{ p: 1.25, borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
            <TextField
              fullWidth
              size="small"
              placeholder={copy?.searchPlaceholder ?? 'Search icon name'}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />
              }}
            />
          </Box>

          <List dense sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
            {filteredIcons.length === 0 && (
              <Typography
                sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', py: 4 }}
              >
                {copy?.empty ?? 'No icons yet'}
              </Typography>
            )}

            {filteredIcons.map((icon) => (
              <ListItemButton
                key={icon.id}
                selected={icon.id === selectedId}
                onClick={() => setSelectedId(icon.id)}
                sx={{ gap: 1.25, py: 0.75 }}
              >
                <Box
                  component="img"
                  src={icon.url}
                  alt={icon.name}
                  sx={{ width: 26, height: 26, objectFit: 'contain', flex: '0 0 auto' }}
                />
                <ListItemText
                  primary={icon.name}
                  primaryTypographyProps={{ fontSize: 12.5, noWrap: true }}
                  secondary={icon.collection ?? 'isoflow'}
                  secondaryTypographyProps={{ fontSize: 10.5, noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Box
          sx={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            p: 2,
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 2
          }}
        >
          {!selectedIcon ? (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
                fontSize: 12.5
              }}
            >
              {copy?.selectHint ?? 'Select an icon from the list'}
            </Box>
          ) : (
            <>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    flex: '0 0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(15,23,42,0.08)',
                    borderRadius: 2,
                    bgcolor: '#fff'
                  }}
                >
                  <Box
                    component="img"
                    src={
                      supportsSource && draftSource
                        ? encodeSvg(draftSource)
                        : selectedIcon.url
                    }
                    alt={draftName}
                    sx={{
                      maxWidth: '86%',
                      maxHeight: '86%',
                      transform: `scale(${clampScale(draftScale)})`
                    }}
                  />
                </Box>

                <TextField
                  size="small"
                  label={copy?.name ?? 'Name'}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  sx={{ flex: 1 }}
                />
              </Stack>

              <Box>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mb: 0.5 }}>
                  {copy?.scale ?? 'Scale'} · {clampScale(draftScale).toFixed(2)}×
                </Typography>
                <Slider
                  min={MIN_ICON_SCALE}
                  max={MAX_ICON_SCALE}
                  step={0.1}
                  value={clampScale(draftScale)}
                  onChange={(_event, value) => setDraftScale(value as number)}
                />
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={draftIsometric}
                    onChange={(event) => setDraftIsometric(event.target.checked)}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 12.5 }}>
                    {copy?.isometric ?? 'Isometric icon'}
                  </Typography>
                }
              />

              <Divider />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                  {copy?.source ?? 'SVG source'}
                </Typography>
                {supportsSource ? (
                  <TextField
                    multiline
                    minRows={6}
                    maxRows={10}
                    value={draftSource}
                    onChange={(event) => setDraftSource(event.target.value)}
                    InputProps={{
                      sx: {
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                        fontSize: 11
                      }
                    }}
                  />
                ) : (
                  <Alert severity="info">
                    {copy?.sourceUnsupported ?? 'Source cannot be edited.'}
                  </Alert>
                )}
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="contained" size="small" onClick={handleApply}>
                  {copy?.apply ?? 'Apply changes'}
                </Button>
                <Button
                  size="small"
                  startIcon={<CopyIcon />}
                  onClick={handleCopy}
                  disabled={!supportsSource}
                >
                  {copy?.copy ?? 'Copy source'}
                </Button>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                  disabled={!supportsSource}
                >
                  {copy?.download ?? 'Download SVG'}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Tooltip title={copy?.delete ?? 'Delete icon'}>
                  <IconButton size="small" color="error" onClick={handleDelete}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};
