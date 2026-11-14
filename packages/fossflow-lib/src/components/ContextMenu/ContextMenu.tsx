import React from 'react';
import { Menu, MenuItem } from '@mui/material';
import { Coords } from 'src/types';

interface MenuItemI {
  label: string;
  icon?: React.ReactNode;
  /** 危险操作（如删除）使用红色高亮 */
  danger?: boolean;
  onClick: () => void;
}

interface Props {
  onClose: () => void;
  position: Coords;
  anchorEl?: HTMLElement;
  menuItems: MenuItemI[];
}

/**
 * 画布右键菜单。样式与运行视图保持一致：细边框、柔和投影、圆角与强调色悬停。
 */
export const ContextMenu = ({
  onClose,
  position,
  anchorEl,
  menuItems
}: Props) => {
  return (
    <Menu
      open
      anchorEl={anchorEl}
      style={{
        left: position.x,
        top: position.y
      }}
      onClose={onClose}
      transitionDuration={120}
      PaperProps={{
        elevation: 0,
        sx: {
          mt: 0.5,
          minWidth: 176,
          p: '6px',
          borderRadius: '12px',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          bgcolor: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(12px)',
          boxShadow:
            '0 2px 6px rgba(15, 23, 42, 0.06), 0 14px 34px rgba(15, 23, 42, 0.14)'
        }
      }}
      MenuListProps={{
        sx: {
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }
      }}
    >
      {menuItems.map((item, index) => {
        return (
          <MenuItem
            key={index}
            onClick={item.onClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: 34,
              px: '9px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: item.danger ? '#b91c1c' : 'rgba(51, 65, 85, 1)',
              transition: 'background 120ms ease, color 120ms ease',
              '&:hover': {
                bgcolor: item.danger
                  ? 'rgba(220, 38, 38, 0.08)'
                  : 'rgba(37, 99, 235, 0.08)',
                color: item.danger ? '#b91c1c' : '#1d4ed8'
              },
              '& .context-menu-icon': {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'inherit',
                opacity: 0.75
              },
              '& .context-menu-icon svg': {
                fontSize: '16px'
              }
            }}
          >
            {item.icon ? <span className="context-menu-icon">{item.icon}</span> : null}
            <span>{item.label}</span>
          </MenuItem>
        );
      })}
    </Menu>
  );
};
