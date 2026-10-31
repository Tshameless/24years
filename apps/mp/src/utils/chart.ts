/**
 * 轻量折线图绘制器。
 *
 * 微信小程序不支持 inline SVG，而领域层 vitalPlot 输出的是 600×200 逻辑坐标系下的
 * 点位，这里负责把逻辑坐标映射到 canvas 实际像素并绘制。只依赖标准 2D 上下文的一个
 * 最小子集，便于在类型不齐的环境里使用。
 */

export interface Canvas2DContext {
  clearRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  fill(): void;
  setLineDash(pattern: readonly number[]): void;
  fillText(text: string, x: number, y: number): void;
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: 'left' | 'center' | 'right';
  textBaseline: 'top' | 'middle' | 'bottom' | 'alphabetic';
}

export interface TrendChartPoint {
  /** 逻辑坐标 x（0..domainWidth） */
  x: number;
  /** 逻辑坐标 y（0..domainHeight） */
  y: number;
  value: number;
}

export interface TrendChartGuideline {
  y: number;
  color: string;
  dashed?: boolean;
}

export interface TrendChartInput {
  /** canvas 实际宽度（CSS 像素） */
  width: number;
  /** canvas 实际高度（CSS 像素） */
  height: number;
  /** 领域层使用的逻辑坐标域，vitalPlot 为 600×200 */
  domainWidth: number;
  domainHeight: number;
  primary: readonly TrendChartPoint[];
  secondary?: readonly TrendChartPoint[];
  guidelines?: readonly TrendChartGuideline[];
  /** 纵轴上下界文字 */
  highLabel: string;
  lowLabel: string;
  /** 横轴起止文字 */
  startLabel: string;
  endLabel: string;
  primaryColor?: string;
  secondaryColor?: string;
  axisColor?: string;
  textColor?: string;
}

const DEFAULTS = {
  primaryColor: '#4caf50',
  secondaryColor: '#f2994a',
  axisColor: '#e5e7eb',
  textColor: '#6b7280',
};

function polyline(
  ctx: Canvas2DContext,
  points: readonly TrendChartPoint[],
  scaleX: number,
  scaleY: number,
): void {
  if (points.length === 0) {
    return;
  }

  ctx.beginPath();
  points.forEach((point, index) => {
    const x = point.x * scaleX;
    const y = point.y * scaleY;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function dots(
  ctx: Canvas2DContext,
  points: readonly TrendChartPoint[],
  scaleX: number,
  scaleY: number,
  color: string,
): void {
  ctx.fillStyle = color;

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x * scaleX, point.y * scaleY, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function line(
  ctx: Canvas2DContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawTrendChart(ctx: Canvas2DContext, input: TrendChartInput): void {
  const {
    width,
    height,
    domainWidth,
    domainHeight,
    primary,
    secondary = [],
    guidelines = [],
    highLabel,
    lowLabel,
    startLabel,
    endLabel,
    primaryColor = DEFAULTS.primaryColor,
    secondaryColor = DEFAULTS.secondaryColor,
    axisColor = DEFAULTS.axisColor,
    textColor = DEFAULTS.textColor,
  } = input;

  if (width <= 0 || height <= 0) {
    return;
  }

  const scaleX = width / domainWidth;
  const scaleY = height / domainHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.textBaseline = 'middle';

  // 坐标轴线：领域层固定 x=55 为纵轴、y=160 为横轴画布。
  const axisX = 55 * scaleX;
  const axisY = 160 * scaleY;
  const axisRight = 545 * scaleX;
  const axisTop = 30 * scaleY;
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  line(ctx, axisX, axisTop, axisX, axisY);
  line(ctx, axisX, axisY, axisRight, axisY);

  // 参考线（如血压 140/90）。
  guidelines.forEach((guide) => {
    ctx.strokeStyle = guide.color;
    ctx.lineWidth = 1;
    ctx.setLineDash(guide.dashed === false ? [] : [4, 4]);
    line(ctx, axisX, guide.y * scaleY, axisRight, guide.y * scaleY);
  });
  ctx.setLineDash([]);

  // 折线。
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  polyline(ctx, primary, scaleX, scaleY);

  if (secondary.length) {
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    polyline(ctx, secondary, scaleX, scaleY);
    ctx.setLineDash([]);
  }

  // 数据点。
  dots(ctx, primary, scaleX, scaleY, primaryColor);

  if (secondary.length) {
    dots(ctx, secondary, scaleX, scaleY, secondaryColor);
  }

  // 文字标注。
  ctx.setLineDash([]);
  ctx.fillStyle = textColor;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(highLabel, 4 * scaleX, axisTop);
  ctx.fillText(lowLabel, 4 * scaleX, axisY);
  ctx.fillText(startLabel, axisX, 190 * scaleY);
  ctx.textAlign = 'right';
  ctx.fillText(endLabel, axisRight, 190 * scaleY);
  ctx.restore();
}
