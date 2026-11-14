import { modelSchema } from 'src/schemas/model';

/**
 * Reproduces the runtime-view blank canvas bug: the persisted diagram strips
 * pack icons, so every item references an icon id that no longer exists.
 */
const diagramWithoutPackIcons = {
  title: 'diagram',
  icons: [],
  items: [
    { id: 'gw', name: 'api-gateway', icon: 'server' },
    { id: 'db', name: 'order-db', icon: 'storage' }
  ],
  views: [
    {
      id: 'v1',
      name: 'main',
      items: [
        { id: 'gw', tile: { x: 0, y: 0 } },
        { id: 'db', tile: { x: 1, y: 0 } }
      ],
      connectors: [
        {
          id: 'c1',
          anchors: [
            { id: 'a1', ref: { item: 'gw' } },
            { id: 'a2', ref: { item: 'db' } }
          ]
        }
      ]
    }
  ],
  colors: [{ id: 'blue', value: '#0066cc' }]
};

const packIcons = [
  {
    id: 'server',
    name: 'server',
    url: '/icons-export/isoflow/server.svg',
    collection: 'isoflow'
  },
  {
    id: 'storage',
    name: 'storage',
    url: '/icons-export/isoflow/storage.svg',
    collection: 'isoflow'
  }
];

const mergeIcons = (diagram: any, loaded: any[]) => {
  const byId = new Map<string, any>();

  [...loaded, ...(diagram.icons ?? [])].forEach((icon) => {
    byId.set(icon.id, icon);
  });

  return { ...diagram, icons: Array.from(byId.values()) };
};

describe('runtime view keeps the canvas', () => {
  it('fails validation when pack icons were stripped', () => {
    const result = modelSchema.safeParse(diagramWithoutPackIcons);

    expect(result.success).toBe(false);
  });

  it('passes validation once loaded pack icons are merged back', () => {
    const merged = mergeIcons(diagramWithoutPackIcons, packIcons);
    const result = modelSchema.safeParse(merged);

    expect(result.success).toBe(true);
  });

  it('keeps diagram icons that are not part of any pack', () => {
    const imported = {
      id: 'custom-logo',
      name: 'custom',
      url: 'data:image/svg+xml;base64,PHN2Zy8+',
      collection: 'imported'
    };
    const merged = mergeIcons(
      { ...diagramWithoutPackIcons, icons: [imported] },
      packIcons
    );
    const ids = (merged.icons as any[]).map((icon) => icon.id);

    expect(ids).toContain('custom-logo');
    expect(ids).toContain('server');
    expect(ids).toContain('storage');
  });
});
