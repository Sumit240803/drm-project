export default function BlockedPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
          background: "#171a21",
          padding: "2rem 1.5rem",
          borderRadius: 8,
          border: "1px solid #262b36",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🖥️</div>
        <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.25rem" }}>
          Available on desktop only
        </h1>
        <p style={{ margin: "0 0 0.5rem", color: "#9aa3b2", lineHeight: 1.5 }}>
          This video can’t be viewed on phones or tablets.
        </p>
        <p style={{ margin: 0, color: "#9aa3b2", lineHeight: 1.5 }}>
          Please open this link on a <strong>Windows desktop computer</strong>{" "}
          using Chrome, Edge, or Firefox.
        </p>
      </div>
    </main>
  );
}
