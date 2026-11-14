import {
  MAX_ICON_SCALE,
  MIN_ICON_SCALE,
  clampScale,
  decodeSvg,
  encodeSvg,
  isSvgDataUrl
} from '../iconCodec';

describe('icon svg codec', () => {
  it('round-trips an ascii svg', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="8"/></svg>';
    const encoded = encodeSvg(svg);

    expect(isSvgDataUrl(encoded)).toBe(true);
    expect(decodeSvg(encoded)).toBe(svg);
  });

  it('round-trips an svg containing chinese text', () => {
    const svg = '<svg><text>服务器图标</text></svg>';

    expect(decodeSvg(encodeSvg(svg))).toBe(svg);
  });

  it('round-trips emoji (surrogate pairs)', () => {
    const svg = '<svg><text>🚀 部署</text></svg>';

    expect(decodeSvg(encodeSvg(svg))).toBe(svg);
  });

  it('decodes a non-base64 utf8 data url', () => {
    const svg = '<svg><text>节点</text></svg>';
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    expect(decodeSvg(url)).toBe(svg);
  });

  it('returns null for non-svg urls', () => {
    expect(decodeSvg('data:image/png;base64,iVBORw0KGgo=')).toBeNull();
    expect(decodeSvg('https://example.com/a.svg')).toBeNull();
  });

  it('returns null for a malformed base64 payload', () => {
    expect(decodeSvg('data:image/svg+xml;base64,@@@')).toBeNull();
  });
});

describe('icon scale clamping', () => {
  it('clamps to the schema range', () => {
    expect(clampScale(0)).toBe(MIN_ICON_SCALE);
    expect(clampScale(-5)).toBe(MIN_ICON_SCALE);
    expect(clampScale(99)).toBe(MAX_ICON_SCALE);
    expect(clampScale(1.234)).toBe(1.23);
  });

  it('falls back to 1 for non numeric input', () => {
    expect(clampScale(Number.NaN)).toBe(1);
  });
});
