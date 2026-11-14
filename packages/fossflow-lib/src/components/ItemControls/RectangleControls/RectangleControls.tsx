import React, { useState } from 'react';
import { Box, FormControlLabel, Switch, Typography } from '@mui/material';
import { useRectangle } from 'src/hooks/useRectangle';
import { ColorSelector } from 'src/components/ColorSelector/ColorSelector';
import { ColorPicker } from 'src/components/ColorSelector/ColorPicker';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { DeleteButton } from '../components/DeleteButton';

interface Props {
  id: string;
}

export const RectangleControls = ({ id }: Props) => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const rectangle = useRectangle(id);
  const { updateRectangle, deleteRectangle } = useScene();
  const [useCustomColor, setUseCustomColor] = useState(!!rectangle?.customColor);

  // If rectangle doesn't exist, return null
  if (!rectangle) {
    return null;
  }

  return (
    <ControlsContainer>
      <Box sx={{ position: 'relative' }}>
        <Section title="Color">
          <FormControlLabel
            control={
              <Switch
                checked={useCustomColor}
                onChange={(e) => {
                  setUseCustomColor(e.target.checked);
                  if (!e.target.checked) {
                    updateRectangle(rectangle.id, { customColor: '' });
                  }
                }}
              />
            }
            label="Use Custom Color"
            sx={{ mb: 2 }}
          />
          {useCustomColor ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ColorPicker
                value={rectangle.customColor || '#000000'}
                onChange={(color) => {
                  updateRectangle(rectangle.id, { customColor: color });
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {rectangle.customColor || '#000000'}
              </Typography>
            </Box>
          ) : (
            <ColorSelector
              onChange={(color) => {
                updateRectangle(rectangle.id, { color, customColor: '' });
              }}
              activeColor={rectangle.color}
            />
          )}
        </Section>
        <Section>
          <Box>
            <DeleteButton
              onClick={() => {
                uiStateActions.setItemControls(null);
                deleteRectangle(rectangle.id);
              }}
            />
          </Box>
        </Section>
      </Box>
    </ControlsContainer>
  );
};
