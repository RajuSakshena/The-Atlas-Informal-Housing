import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        background: "white",
        borderBottom: "1px solid #e5e5e5",
        padding: "15px 0",
        textAlign: "center"
      }}
    >
      
      {/* Title Row */}
      <div
        style={{
          fontSize: "24px",
          fontWeight: "600",
          color: "#333",
          marginBottom: "10px"
        }}
      >
        The Atlas of Informal Housing
      </div>

      {/* Navigation Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "40px",
          fontSize: "16px",
          fontWeight: "500"
        }}
      >
        <Link to="/" style={{ textDecoration: "none", color: "#555" }}>
          Home
        </Link>

        <Link to="/about" style={{ textDecoration: "none", color: "#555" }}>
          About
        </Link>

        <Link to="/partners" style={{ textDecoration: "none", color: "#555" }}>
          Partners
        </Link>
      </div>

    </nav>
  );
}

export default Navbar;