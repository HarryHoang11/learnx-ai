"use client";

import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { useBackButtonToClose } from "@/lib/native/useBackButton";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Tiêu đề hiển thị trên "tay nắm" — thường là tên màn hình đang mở. */
  title?: ReactNode;
  children: ReactNode;
  /** Nhãn truy cập khi không truyền title. */
  ariaLabel?: string;
  /** Cao tối đa; mặc định 88dvh (bám theo viewport động của mobile). */
  maxHeight?: string;
}

/** Ngưỡng kéo xuống để đóng (px) — nhỏ hơn thì co lại, không mất sheet. */
const DISMISS_DISTANCE = 110;
/** Vuốt nhanh tay cũng đóng, dù kéo chưa đủ ngưỡng (gesture vuốt quen thuộc). */
const DISMISS_VELOCITY = 0.6; // px/ms

// ================================================================
// <BottomSheet /> — panel trượt lên từ đáy màn hình (native iOS)
// ================================================================
// Mạch tư duy: đây là pattern quen thuộc nhất trên mobile cho "nội dung phụ"
// (menu thêm, chi tiết 1 item, chọn định dạng...). Ở desktop cùng nội dung đó
// nằm cột bên/panel, nên component này CHỈ dùng ở mobile — bên ngoài nó không
// hiện gì cả (xem globals.css: .bottom-sheet-backdrop{display:none} và
// hiển thị trong @media max-width 880px).
//
// Ba hành vi đúng chuẩn native, không phải chỉ "cho có":
//   1. Vuốt tay nắm xuống để đóng (pointer events + cảm giác tốc độ).
//   2. Bấm nền mờ / phím ESC để đóng.
//   3. Khoá cuộn trang + chặn scroll "lây" sang nền, mở/đóng sạch sẽ.
// Cả 3 đều dùng chung với <Modal>/<Drawer> sẵn có để không lệch cách xử lý.
// ================================================================

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  ariaLabel,
  maxHeight,
}: BottomSheetProps) {
  // offsetY: độ dịch xuống (px) đang kéo — dùng cho transform để ngón tay
  // "bám" sheet thay vì sheet tự nhảy về vị trí cũ.
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Đọc trong handler sự kiện mà không cần đưa vào deps để tránh effect chạy lại.
  const dragRef = useRef<{ startY: number; lastY: number; lastAt: number } | null>(null);

  // Khoá cuộn nền + đóng bằng ESC. Giữ đúng cơ chế của Modal/Drawer: nhớ
  // lại overflow cũ rồi khôi phục, để 2 lớp overlay mở chồng nhau không làm
  // mất trạng thái scroll của lớp dưới.
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  // NÚT BACK ANDROID: sheet đang mở là lớp phủ trên cùng nên phải ăn nút back
  // TRƯỚC khi trình duyệt quay lại trang trước — nếu không, bấm back sẽ đi
  // khỏi trang mà sheet vẫn còn mở.
  useBackButtonToClose(open, onClose);

  // Đóng bằng điều hướng/route đổi (vd bấm 1 mục trong sheet "Thêm" rồi
  // component cha unmount) phải trả transform về 0, nếu không lần mở sau
  // sẽ nhảy vào giữa màn hình.
  useEffect(() => {
    if (!open) {
      setOffsetY(0);
      setDragging(false);
      dragRef.current = null;
    }
  }, [open]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragRef.current = { startY: event.clientY, lastY: event.clientY, lastAt: event.timeStamp };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    // Chỉ kéo XUỐNG: vuốt lên từ mép dưới là cuộn nội dung bên trong
    // (overscroll), không phải đóng sheet — nên phần âm bị cắt về 0.
    setOffsetY(Math.max(0, event.clientY - drag.startY));
    drag.lastY = event.clientY;
    drag.lastAt = event.timeStamp;
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag) return;
    const elapsed = Math.max(1, event.timeStamp - drag.lastAt);
    const velocity = (event.clientY - drag.lastY) / elapsed; // px/ms, dương = kéo xuống
    if (offsetY > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      onClose();
      return;
    }
    setOffsetY(0);
  }

  if (!open) return null;

  return (
    <div
      className="bottom-sheet-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`bottom-sheet${dragging ? " is-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : ariaLabel}
        style={maxHeight ? { maxHeight, transform: `translateY(${offsetY}px)` } : { transform: `translateY(${offsetY}px)` }}
        // Chặn phím Tab không thoát ra nền: overlay có aria-modal nên bàn phím
        // coi phần còn lại là ẩn; dừng sự kiện tại đây là đủ cho sheet ngắn.
        onKeyDown={(event) => event.stopPropagation()}
      >
        {/* Vùng kéo: tay nắm + tiêu đề. Cả vùng này nằm trong .bottom-sheet
            nên chạm bất cứ đâu vào cũng kéo được — đúng cảm giác sheet native. */}
        <div
          className="bottom-sheet-handle"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <span className="bottom-sheet-grip" aria-hidden="true" />
          {title ? <h3 className="bottom-sheet-title">{title}</h3> : null}
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </div>
  );
}
