/**
 * 生成等距风格 DevOps 图标 SVG，写入 icons-export/xiaocaitest。
 * 风格对齐现有图标：平涂 + 深色描边（#010202）+ 顶面最亮、左侧中间调、右侧最暗。
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..', 'icons-export', 'xiaocaitest');

const W = 60;
const H = 32;
const BODY_H = 46;
const CX = 80;
const CY = 40;
const VIEW_W = 160;
const VIEW_H = 130;

const round = (n) => Math.round(n * 10) / 10;

const pointsOf = (pairs) => pairs.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');

const shade = (hex, ratio) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((num >> 16) & 0xff) * (1 + ratio));
  const g = clamp(((num >> 8) & 0xff) * (1 + ratio));
  const b = clamp((num & 0xff) * (1 + ratio));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const svgWrap = (body) => `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"
	 width="${VIEW_W}px" height="${VIEW_H}px" viewBox="0 0 ${VIEW_W} ${VIEW_H}" xml:space="preserve">
<g id="Layer_1">${body}
</g>
</svg>
`;

/** 等距立方体三面，topHex 为基色 */
const isoCubeFaces = (topHex, cx = CX, cy = CY, w = W, h = H, bodyH = BODY_H) => {
  const top = [
    [cx, cy - h],
    [cx + w, cy],
    [cx, cy + h],
    [cx - w, cy]
  ];
  const left = [
    [cx - w, cy],
    [cx, cy + h],
    [cx, cy + h + bodyH],
    [cx - w, cy + bodyH]
  ];
  const right = [
    [cx + w, cy],
    [cx, cy + h],
    [cx, cy + h + bodyH],
    [cx + w, cy + bodyH]
  ];

  return `
	<polygon fill="${shade(topHex, 0.16)}" stroke="#010202" stroke-width="0.5" stroke-linejoin="round" points="${pointsOf(top)}"/>
	<polygon fill="${shade(topHex, -0.16)}" stroke="#010202" stroke-width="0.5" stroke-linejoin="round" points="${pointsOf(left)}"/>
	<polygon fill="${shade(topHex, -0.36)}" stroke="#010202" stroke-width="0.5" stroke-linejoin="round" points="${pointsOf(right)}"/>`;
};

/** 立方体底座 + 自定义前景（前景裁剪在立方体轮廓内，避免溢出） */
const withForeground = (topHex, foreground, cx = CX, cy = CY, w = W, h = H, bodyH = BODY_H) => {
  const top = [
    [cx, cy - h],
    [cx + w, cy],
    [cx, cy + h],
    [cx - w, cy]
  ];
  const left = [
    [cx - w, cy],
    [cx, cy + h],
    [cx, cy + h + bodyH],
    [cx - w, cy + bodyH]
  ];
  const right = [
    [cx + w, cy],
    [cx, cy + h],
    [cx, cy + h + bodyH],
    [cx + w, cy + bodyH]
  ];
  const clipId = 'cubeClip';

  return svgWrap(`
	<defs>
		<clipPath id="${clipId}">
			<polygon points="${pointsOf(top)}"/>
			<polygon points="${pointsOf(left)}"/>
			<polygon points="${pointsOf(right)}"/>
		</clipPath>
	</defs>
	${isoCubeFaces(topHex, cx, cy, w, h, bodyH)}
	<g clip-path="url(#${clipId})">
	${foreground}
	</g>`);
};

const single = (topHex) => svgWrap(isoCubeFaces(topHex));

const database = (topHex, withLabel = false) => {
  const cx = CX;
  const topY = 30;
  const rx = 52;
  const ry = 19;
  const bodyH = 58;
  const mid = shade(topHex, -0.18);
  const dark = shade(topHex, -0.4);

  return svgWrap(`
	<path fill="${mid}" stroke="#010202" stroke-width="0.5" stroke-linejoin="round"
		d="M${cx - rx},${topY} L${cx - rx},${topY + bodyH}
		A${rx},${ry} 0 0 0 ${cx + rx},${topY + bodyH}
		L${cx + rx},${topY}
		A${rx},${ry} 0 0 1 ${cx - rx},${topY} Z"/>
	<ellipse cx="${cx}" cy="${topY + bodyH}" rx="${rx}" ry="${ry}" fill="${dark}" stroke="#010202" stroke-width="0.5"/>
	<ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ry}" fill="${shade(topHex, 0.18)}" stroke="#010202" stroke-width="0.5"/>
	<ellipse cx="${cx}" cy="${topY}" rx="${rx * 0.6}" ry="${ry * 0.6}" fill="none" stroke="#010202" stroke-width="0.5" opacity="0.5"/>
	<rect x="${cx - 22}" y="${topY + 28}" width="44" height="6" rx="3" fill="#ffffff" opacity="0.6"/>
	${withLabel ? `<rect x="${cx - 22}" y="${topY + 40}" width="28" height="6" rx="3" fill="#ffffff" opacity="0.4"/>` : ''}
`);
};

const queue = (topHex) => {
  const bars = Array.from({ length: 4 })
    .map((_, i) => {
      return `<rect x="${62 + i * 12}" y="${62 + i * 6}" width="7" height="22" rx="2" fill="#ffffff" opacity="0.8"/>`;
    })
    .join('\n\t');

  return withForeground(topHex, bars);
};

const monitor = (topHex) => {
  const bars = [
    { dx: -20, h: 10 },
    { dx: -6, h: 18 },
    { dx: 8, h: 13 },
    { dx: 22, h: 24 }
  ]
    .map(({ dx, h }) => {
      return `<rect x="${CX + dx}" y="${CY + 40 - h}" width="8" height="${h}" rx="2" fill="#ffffff" opacity="0.82"/>`;
    })
    .join('\n\t');

  return withForeground(topHex, bars);
};

const MANIFESTS = [
  { file: 'Redis.svg', content: database('#D63B3B', true) },
  { file: 'MongoDB.svg', content: database('#4DB33D', true) },
  { file: 'Elasticsearch.svg', content: database('#F5B300', true) },
  { file: 'ClickHouse.svg', content: database('#E9C41B', true) },
  { file: 'MinIO.svg', content: database('#C72C48', true) },
  { file: 'RabbitMQ.svg', content: queue('#FF6600') },
  { file: 'RocketMQ.svg', content: queue('#D77310') },
  { file: 'Zookeeper.svg', content: single('#7B8FA1') },
  { file: 'APIGateway.svg', content: single('#8C4FFF') },
  { file: 'Envoy.svg', content: single('#AC6199') },
  { file: 'Consul.svg', content: single('#DC477D') },
  { file: 'Etcd.svg', content: single('#419EDA') },
  { file: 'Prometheus.svg', content: monitor('#E6522C') },
  { file: 'Grafana.svg', content: monitor('#F46800') },
  { file: 'Jaeger.svg', content: monitor('#66CFE3') },
  { file: 'ELK.svg', content: monitor('#005571') },
  { file: 'Docker.svg', content: single('#2496ED') },
  { file: 'KubernetesCluster.svg', content: single('#326CE5') },
  { file: 'Serverless.svg', content: single('#FD5750') },
  { file: 'CDN.svg', content: single('#F5A623') },
  { file: 'ObjectStorage.svg', content: single('#3F8624') },
  { file: 'VPC.svg', content: single('#7AA116') },
  { file: 'WAF.svg', content: single('#DD3522') },
  { file: 'VPN.svg', content: single('#5A6F8C') },
  { file: 'BastionHost.svg', content: single('#8C6D46') },
  { file: 'CICD.svg', content: single('#2088FF') },
  { file: 'GitRepo.svg', content: single('#F05032') },
  { file: 'ServiceMesh.svg', content: single('#466BB0') }
];

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

for (const { file, content } of MANIFESTS) {
  fs.writeFileSync(path.join(OUT_DIR, file), content, 'utf8');
}

console.log(`已生成 ${MANIFESTS.length} 个图标到 ${OUT_DIR}`);
