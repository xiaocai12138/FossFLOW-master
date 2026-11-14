/**
 * 图标 SVG 源码的编解码与缩放工具。
 *
 * 不依赖 TextEncoder / TextDecoder：前者在 jsdom 与部分旧浏览器中缺失，
 * 这里直接用纯函数实现 UTF-8 转换，保证任何环境下行为一致。
 */

export const SVG_DATA_PREFIX = 'data:image/svg+xml';

export const MIN_ICON_SCALE = 0.1;
export const MAX_ICON_SCALE = 3;

export const isSvgDataUrl = (url: string) => url.startsWith(SVG_DATA_PREFIX);

/** UTF-8 字符串 → 二进制字符串（每个字符一个字节） */
const toBinaryString = (input: string): string => {
  const bytes: number[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // 代理对，合成一个码点再编码为 4 字节
      const next = input.charCodeAt(index + 1);
      const codePoint = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);

      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
      index += 1;
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  return bytes.map((byte) => String.fromCharCode(byte)).join('');
};

/** 二进制字符串 → UTF-8 字符串 */
const fromBinaryString = (binary: string): string => {
  const bytes: number[] = [];

  for (let index = 0; index < binary.length; index += 1) {
    bytes.push(binary.charCodeAt(index));
  }

  let output = '';
  let index = 0;

  while (index < bytes.length) {
    const byte = bytes[index];

    if (byte < 0x80) {
      output += String.fromCharCode(byte);
      index += 1;
    } else if ((byte & 0xe0) === 0xc0) {
      output += String.fromCharCode(
        ((byte & 0x1f) << 6) | (bytes[index + 1] & 0x3f)
      );
      index += 2;
    } else if ((byte & 0xf0) === 0xe0) {
      output += String.fromCharCode(
        ((byte & 0x0f) << 12) |
          ((bytes[index + 1] & 0x3f) << 6) |
          (bytes[index + 2] & 0x3f)
      );
      index += 3;
    } else {
      const codePoint =
        ((byte & 0x07) << 18) |
        ((bytes[index + 1] & 0x3f) << 12) |
        ((bytes[index + 2] & 0x3f) << 6) |
        (bytes[index + 3] & 0x3f);
      const adjusted = codePoint - 0x10000;

      output += String.fromCharCode(
        0xd800 + (adjusted >> 10),
        0xdc00 + (adjusted & 0x3ff)
      );
      index += 4;
    }
  }

  return output;
};

/** dataURL → SVG 文本；非 SVG 或解析失败返回 null */
export const decodeSvg = (url: string): string | null => {
  if (!isSvgDataUrl(url)) return null;

  const commaIndex = url.indexOf(',');

  if (commaIndex < 0) return null;

  const header = url.slice(0, commaIndex);
  const payload = url.slice(commaIndex + 1);

  try {
    if (!header.includes('base64')) return decodeURIComponent(payload);

    return fromBinaryString(atob(payload));
  } catch {
    return null;
  }
};

/** SVG 文本 → dataURL */
export const encodeSvg = (text: string) => {
  return `${SVG_DATA_PREFIX};base64,${btoa(toBinaryString(text))}`;
};

/** 把缩放值夹紧到 schema 允许的 0.1 - 3 */
export const clampScale = (value: number) => {
  const parsed = Number.isFinite(value) ? value : 1;

  return Math.min(
    MAX_ICON_SCALE,
    Math.max(MIN_ICON_SCALE, Number(parsed.toFixed(2)))
  );
};
