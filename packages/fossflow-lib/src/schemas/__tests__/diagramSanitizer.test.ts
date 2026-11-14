import { modelSchema } from 'src/schemas/model';

/**
 * Mirrors packages/fossflow-app/src/services/diagramSanitizer.ts. The app
 * package has no jest setup, so the contract is verified against the real
 * schema here.
 */
import { sanitizeDiagram } from '../../../../fossflow-app/src/services/diagramSanitizer';

const base = {
  title: 'probe',
  icons: [
    {
      id: 'server',
      name: 'server',
      url: '/icons-export/isoflow/server.svg',
      collection: 'isoflow'
    }
  ],
  items: [{ id: 'gw', name: 'gateway', icon: 'server' }],
  views: [
    {
      id: 'v1',
      name: 'main',
      items: [{ id: 'gw', tile: { x: 0, y: 0 } }],
      connectors: []
    }
  ],
  colors: [{ id: 'blue', value: '#0066cc' }]
};

const brokenShapes: Array<[string, any]> = [
  [
    'dangling icon reference',
    { ...base, items: [{ id: 'gw', name: 'gateway', icon: 'missing' }] }
  ],
  [
    'icons empty with icon references',
    { ...base, icons: [], items: [{ id: 'gw', name: 'gateway', icon: 'server' }] }
  ],
  [
    'color value longer than 7 chars',
    { ...base, colors: [{ id: 'c', value: '#0066ccff' }] }
  ],
  ['color value in rgb() form', { ...base, colors: [{ id: 'c', value: 'rgb(0,0,0)' }] }],
  [
    'view item without model item',
    {
      ...base,
      views: [
        {
          id: 'v1',
          name: 'main',
          items: [{ id: 'ghost', tile: { x: 0, y: 0 } }],
          connectors: []
        }
      ]
    }
  ],
  [
    'connector with one anchor',
    {
      ...base,
      views: [
        {
          id: 'v1',
          name: 'main',
          items: [{ id: 'gw', tile: { x: 0, y: 0 } }],
          connectors: [{ id: 'c1', anchors: [{ id: 'a1', ref: { item: 'gw' } }] }]
        }
      ]
    }
  ],
  [
    'connector anchor to missing view item',
    {
      ...base,
      views: [
        {
          id: 'v1',
          name: 'main',
          items: [{ id: 'gw', tile: { x: 0, y: 0 } }],
          connectors: [
            {
              id: 'c1',
              anchors: [
                { id: 'a1', ref: { item: 'gw' } },
                { id: 'a2', ref: { item: 'nope' } }
              ]
            }
          ]
        }
      ]
    }
  ],
  ['title over 100 chars', { ...base, title: 'x'.repeat(101) }],
  [
    'item name over 100 chars',
    { ...base, items: [{ id: 'gw', name: 'x'.repeat(101), icon: 'server' }] }
  ],
  [
    'tile coordinates as strings',
    {
      ...base,
      views: [
        {
          id: 'v1',
          name: 'main',
          items: [{ id: 'gw', tile: { x: '0', y: '0' } as any }],
          connectors: []
        }
      ]
    }
  ]
];

describe('diagramSanitizer against modelSchema', () => {
  it('leaves a healthy diagram untouched', () => {
    const { data, changes } = sanitizeDiagram(base);

    expect(changes).toEqual([]);
    expect(modelSchema.safeParse(data).success).toBe(true);
  });

  it('repairs every known broken shape', () => {
    for (const [label, broken] of brokenShapes) {
      const before = modelSchema.safeParse(broken).success;
      const { data, changes } = sanitizeDiagram(broken);
      const after = modelSchema.safeParse(data).success;

      // eslint-disable-next-line no-console
      console.log(
        `${label.padEnd(36)} before=${before} after=${after} changes=${changes.length}`
      );

      expect(after).toBe(true);
      expect(changes.length).toBeGreaterThan(0);
    }
  });

  it('handles completely malformed input', () => {
    for (const shape of [null, undefined, {}, { icons: null, views: null }]) {
      const { data } = sanitizeDiagram(shape as any);

      expect(modelSchema.safeParse(data).success).toBe(true);
    }
  });
});
