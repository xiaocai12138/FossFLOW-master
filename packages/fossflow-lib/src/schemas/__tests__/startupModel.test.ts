import { modelSchema } from 'src/schemas/model';

/**
 * Guards the startup path: a persisted diagram references pack icons by id.
 * Restoring it with only `imported` icons kept makes validation fail, which is
 * what surfaced as "There is an error in your model." on app boot.
 */
const persisted = {
  title: 'diagram',
  icons: [
    {
      id: 'server',
      name: 'server',
      url: '/icons-export/isoflow/server.svg',
      collection: 'isoflow'
    },
    {
      id: 'custom',
      name: 'custom',
      url: 'data:image/svg+xml;base64,PHN2Zy8+',
      collection: 'imported'
    }
  ],
  items: [
    { id: 'gw', name: 'api-gateway', icon: 'server' },
    { id: 'app', name: 'app', icon: 'custom' }
  ],
  views: [
    {
      id: 'v1',
      name: 'main',
      items: [
        { id: 'gw', tile: { x: 0, y: 0 } },
        { id: 'app', tile: { x: 1, y: 0 } }
      ],
      connectors: []
    }
  ],
  colors: [{ id: 'blue', value: '#0066cc' }]
};

const keepOnlyImported = (data: any) => ({
  ...data,
  icons: (data.icons ?? []).filter((icon: any) => icon.collection === 'imported')
});

describe('startup model initialisation', () => {
  it('rejects a restore that keeps only imported icons', () => {
    const result = modelSchema.safeParse(keepOnlyImported(persisted));

    expect(result.success).toBe(false);
  });

  it('accepts the restore that keeps every persisted icon', () => {
    const result = modelSchema.safeParse({ ...persisted });

    expect(result.success).toBe(true);
  });

  it('accepts a pack-icon-free diagram (nothing to resolve)', () => {
    const noPackIcons = {
      ...persisted,
      items: [{ id: 'app', name: 'app', icon: 'custom' }],
      views: [
        {
          id: 'v1',
          name: 'main',
          items: [{ id: 'app', tile: { x: 0, y: 0 } }],
          connectors: []
        }
      ]
    };
    const result = modelSchema.safeParse(keepOnlyImported(noPackIcons));

    expect(result.success).toBe(true);
  });
});
