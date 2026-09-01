// ================================================================
// <Topbar /> — thanh trên cùng của mọi trang trong (app)
// ================================================================
// Mạch tư duy: tách khỏi Sidebar vì lý do bố cục khác hẳn (nằm ngang,
// trên đầu content thay vì dọc bên trái) — gộp chung 1 component
// "layout" duy nhất sẽ khiến props/logic dễ rối khi 1 trong 2 phần
// cần thay đổi độc lập (vd Topbar sau này thêm dropdown thông báo).
// MVP: tên học sinh hard-code — khi có auth thật, truyền qua props
// hoặc đọc từ session ở server rồi pass xuống.
// ================================================================

export default function Topbar() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Nguyễn Quỳnh · Lớp 10</span>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--cyan), var(--indigo))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "#0a0e16",
          }}
        >
          NQ
        </div>
      </div>
    </div>
  );
}
