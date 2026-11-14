import React from 'react';
import {
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography
} from '@mui/material';
import { useLocale } from 'src/stores/localeStore';

export interface LanguageOption {
  label: string;
  value: string;
}

export interface LanguageSettingsProps {
  language?: string;
  supportedLanguages?: LanguageOption[];
  onLanguageChange?: (lang: string) => void;
}

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
];

export const LanguageSettings = ({
  language,
  supportedLanguages,
  onLanguageChange
}: LanguageSettingsProps) => {
  const locale = useLocale();
  const copy = locale.settings.language;
  const current = language ?? 'zh-CN';
  const options = supportedLanguages?.length
    ? supportedLanguages
    : [
        { label: copy?.zhCN ?? DEFAULT_LANGUAGES[0].label, value: 'zh-CN' },
        { label: copy?.enUS ?? DEFAULT_LANGUAGES[1].label, value: 'en-US' }
      ];

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {copy?.description ?? 'Choose the interface language.'}
      </Typography>

      <FormControl component="fieldset" variant="standard">
        <RadioGroup
          value={current}
          onChange={(event) => {
            onLanguageChange?.(event.target.value);
          }}
        >
          {options.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio />}
              label={option.label}
            />
          ))}
        </RadioGroup>
      </FormControl>

      {!onLanguageChange && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          {copy?.description ?? ''}
        </Typography>
      )}
    </Box>
  );
};
