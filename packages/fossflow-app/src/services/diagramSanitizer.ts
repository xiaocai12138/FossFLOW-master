export interface DiagramSanitizeResult {
  data: any;
  changes: string[];
}

/**
 * Repairs model shapes that `modelSchema` rejects but that the canvas can still
 * render: dangling icon/item references, malformed colours, over-long names,
 * non-numeric tiles and single-anchor connectors.
 *
 * Anything repaired is reported in `changes` so the caller can log it instead
 * of silently mutating the user's diagram.
 */
export const sanitizeDiagram = (input: any): DiagramSanitizeResult => {
  const changes: string[] = [];
  const data = { ...(input ?? {}) };

  if (typeof data.title !== 'string') {
    data.title = 'Untitled Diagram';
    changes.push('title reset');
  } else if (data.title.length > 100) {
    data.title = data.title.slice(0, 100);
    changes.push('title truncated to 100 chars');
  }

  const icons = Array.isArray(data.icons) ? data.icons : [];
  if (!Array.isArray(data.icons)) changes.push('icons defaulted to []');

  const colors = Array.isArray(data.colors) ? data.colors : [];
  if (!Array.isArray(data.colors)) changes.push('colors defaulted to []');

  const fixedColors = colors.map((color: any, index: number) => {
    if (!color || typeof color !== 'object') {
      changes.push(`colors[${index}] dropped (not an object)`);
      return null;
    }

    if (typeof color.value !== 'string') {
      changes.push(`colors[${index}].value reset`);
      return { ...color, value: '#000000' };
    }

    if (color.value.length > 7) {
      changes.push(`colors[${index}].value truncated to 7 chars`);
      return { ...color, value: color.value.slice(0, 7) };
    }

    return color;
  }).filter(Boolean);

  const knownIconIds = new Set(icons.map((icon: any) => icon?.id).filter(Boolean));

  const items = (Array.isArray(data.items) ? data.items : []).map(
    (item: any, index: number) => {
      if (!item || typeof item !== 'object') {
        changes.push(`items[${index}] dropped (not an object)`);
        return null;
      }

      let next = item;

      if (typeof next.name !== 'string') {
        next = { ...next, name: next.id ? String(next.id) : `item-${index}` };
        changes.push(`items[${index}].name filled`);
      } else if (next.name.length > 100) {
        next = { ...next, name: next.name.slice(0, 100) };
        changes.push(`items[${index}].name truncated to 100 chars`);
      }

      if (next.description && String(next.description).length > 1000) {
        next = { ...next, description: String(next.description).slice(0, 1000) };
        changes.push(`items[${index}].description truncated to 1000 chars`);
      }

      if (next.icon && !knownIconIds.has(next.icon)) {
        const { icon, ...rest } = next;
        next = rest;
        changes.push(`items[${index}].icon "${icon}" dropped (icon not found)`);
      }

      return next;
    }
  ).filter(Boolean);

  const knownItemIds = new Set(items.map((item: any) => item?.id).filter(Boolean));

  const views = (Array.isArray(data.views) ? data.views : []).map(
    (view: any, viewIndex: number) => {
      if (!view || typeof view !== 'object') {
        changes.push(`views[${viewIndex}] dropped (not an object)`);
        return null;
      }

      let next = view;

      if (typeof next.name !== 'string' || next.name.length > 100) {
        next = { ...next, name: String(next.name ?? `view-${viewIndex}`).slice(0, 100) };
        changes.push(`views[${viewIndex}].name normalised`);
      }

      const viewItems = (Array.isArray(next.items) ? next.items : [])
        .map((viewItem: any, itemIndex: number) => {
          if (!viewItem || typeof viewItem !== 'object') {
            changes.push(`views[${viewIndex}].items[${itemIndex}] dropped`);
            return null;
          }

          if (!knownItemIds.has(viewItem.id)) {
            changes.push(
              `views[${viewIndex}].items[${itemIndex}] dropped (no model item "${viewItem.id}")`
            );
            return null;
          }

          const tile = viewItem.tile ?? {};

          if (typeof tile.x !== 'number' || typeof tile.y !== 'number') {
            changes.push(
              `views[${viewIndex}].items[${itemIndex}].tile coerced to numbers`
            );

            return {
              ...viewItem,
              tile: { x: Number(tile.x) || 0, y: Number(tile.y) || 0 }
            };
          }

          return viewItem;
        })
        .filter(Boolean);

      const survivingItemIds = new Set(
        viewItems.map((viewItem: any) => viewItem?.id).filter(Boolean)
      );

      const connectors = (Array.isArray(next.connectors) ? next.connectors : [])
        .map((connector: any, connectorIndex: number) => {
          if (!connector || typeof connector !== 'object') {
            changes.push(`views[${viewIndex}].connectors[${connectorIndex}] dropped`);
            return null;
          }

          const anchors = (Array.isArray(connector.anchors) ? connector.anchors : [])
            .filter((anchor: any) => {
              if (!anchor || typeof anchor !== 'object') return false;

              const refItem = anchor.ref?.item;

              // Anchors referencing a dropped view item would fail validation.
              return !refItem || survivingItemIds.has(refItem);
            });

          if (anchors.length !== (connector.anchors ?? []).length) {
            changes.push(
              `views[${viewIndex}].connectors[${connectorIndex}] anchors pruned`
            );
          }

          if (anchors.length < 2) {
            changes.push(
              `views[${viewIndex}].connectors[${connectorIndex}] dropped (fewer than 2 valid anchors)`
            );

            return null;
          }

          return { ...connector, anchors };
        })
        .filter(Boolean);

      next = { ...next, items: viewItems, connectors };

      const rectangles = (Array.isArray(next.rectangles) ? next.rectangles : [])
        .filter((rectangle: any, rectangleIndex: number) => {
          const from = rectangle?.from;
          const to = rectangle?.to;
          const valid =
            typeof from?.x === 'number' &&
            typeof from?.y === 'number' &&
            typeof to?.x === 'number' &&
            typeof to?.y === 'number';

          if (!valid) {
            changes.push(
              `views[${viewIndex}].rectangles[${rectangleIndex}] dropped (invalid coords)`
            );
          }

          return valid;
        });

      if (Array.isArray(next.rectangles)) {
        next = { ...next, rectangles };
      }

      const textBoxes = (Array.isArray(next.textBoxes) ? next.textBoxes : [])
        .filter((textBox: any) => {
          const tile = textBox?.tile;

          return typeof tile?.x === 'number' && typeof tile?.y === 'number';
        });

      if (Array.isArray(next.textBoxes)) {
        next = { ...next, textBoxes };
      }

      return next;
    }
  ).filter(Boolean);

  return {
    data: { ...data, icons, colors: fixedColors, items, views },
    changes
  };
};
