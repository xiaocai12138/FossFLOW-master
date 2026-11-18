import React, {
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState
} from 'react';
import {
  lockCanvasInteractions,
  unlockCanvasInteractions
} from 'fossflow';
import './DraggableModal.css';

export interface DraggableModalProps {
  title: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  onClose: () => void;
  width?: number;
  placement?: 'top-right';
  allowCanvasInteraction?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}

interface DragOrigin {
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const MARGIN = 8;

const stopCanvasEvent = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * 标题栏可拖动，拖动范围被限制在视口内。
 */
export const DraggableModal = ({
  title,
  icon,
  badge,
  onClose,
  width = 520,
  placement,
  allowCanvasInteraction = false,
  panelClassName,
  bodyClassName,
  children
}: DraggableModalProps) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<DragOrigin | null>(null);
  const offsetRef = useRef(offset);

  useEffect(() => {
    if (allowCanvasInteraction) return;

    lockCanvasInteractions();

    return () => unlockCanvasInteractions();
  }, [allowCanvasInteraction]);

  // 非模态弹窗只拦截从弹窗内开始的交互，画布上的拖动仍可跨过弹窗。
  const isolateCanvasEvent = allowCanvasInteraction ? stopCanvasEvent : undefined;

  offsetRef.current = offset;

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    // 不要拦截标题栏内的按钮点击
    if ((event.target as HTMLElement).closest('button')) return;

    const panel = panelRef.current;

    if (!panel) return;

    const rect = panel.getBoundingClientRect();

    originRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: offsetRef.current.x,
      offsetY: offsetRef.current.y,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };

    setDragging(true);
    event.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (event: PointerEvent) => {
      const origin = originRef.current;

      if (!origin) return;

      const dx = event.clientX - origin.pointerX;
      const dy = event.clientY - origin.pointerY;

      const maxLeft = window.innerWidth - origin.width - MARGIN;
      const maxTop = window.innerHeight - origin.height - MARGIN;

      const targetLeft = clamp(origin.left + dx, MARGIN, Math.max(MARGIN, maxLeft));
      const targetTop = clamp(origin.top + dy, MARGIN, Math.max(MARGIN, maxTop));

      setOffset({
        x: origin.offsetX + (targetLeft - origin.left),
        y: origin.offsetY + (targetTop - origin.top)
      });
    };

    const handleUp = () => setDragging(false);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragging]);

  return (
    <div
      className={`rtm-backdrop ${placement === 'top-right' ? 'rtm-top-right' : ''} ${dragging ? 'is-dragging' : ''}`}
      data-canvas-interaction={allowCanvasInteraction ? 'allow' : undefined}
    >
      <div
        ref={panelRef}
        className={panelClassName ? `rtm-panel ${panelClassName}` : 'rtm-panel'}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        onMouseDown={isolateCanvasEvent}
        onTouchStart={isolateCanvasEvent}
        onContextMenu={isolateCanvasEvent}
        onKeyDown={isolateCanvasEvent}
        style={{
          width,
          transform: `translate(${offset.x}px, ${offset.y}px)`
        }}
      >
        <header className="rtm-header" onPointerDown={handlePointerDown}>
          <div className="rtm-title">
            {icon ? <span className="rtm-title-icon">{icon}</span> : null}
            <strong id={titleId}>{title}</strong>
            {badge}
          </div>
          <button className="rtm-close" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className={bodyClassName ? `rtm-body ${bodyClassName}` : 'rtm-body'}>{children}</div>
      </div>
    </div>
  );
};

export default DraggableModal;
