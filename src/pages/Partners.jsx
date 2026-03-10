import cfsd from "../images/cfsd.jpeg";
import tmi from "../images/TMI.png";

export default function Partners() {
  const partners = [
    {
      name: "Centre for Social Development (CFSD)",
      image: cfsd,
      website: "https://cfsdindia.org/",
      description:
        "Centre for Social Development (CFSD) works towards inclusive urban and social development through research, capacity building, and community-based initiatives."
    },
    {
      name: "The Metropolitan Institute (TMI)",
      image: tmi,
      website: "https://themetropolitaninstitute.com/",
      description:
        "The Metropolitan Institute (TMI) is a social impact think-and-do-tank that works at the confluence of government, civil society, and the market."
    }
  ];

  return (
    <div
      style={{
        padding: "60px 40px",
        background: "#f7f7f7",
        minHeight: "100vh"
      }}
    >
      <h1
        style={{
          textAlign: "center",
          marginBottom: "50px",
          fontSize: "34px",
          color: "#222"
        }}
      >
        Our Partners
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "30px",
          maxWidth: "900px",
          margin: "auto"
        }}
      >
        {partners.map((partner, index) => (
          <div
            key={index}
            style={{
              background: "white",
              borderRadius: "10px",
              padding: "25px",
              textAlign: "center",
              boxShadow: "0 4px 15px rgba(0,0,0,0.08)"
            }}
          >
            <img
              src={partner.image}
              alt={partner.name}
              style={{
                width: "120px",
                height: "120px",
                objectFit: "contain",
                marginBottom: "20px"
              }}
            />

            <h3
              style={{
                fontSize: "20px",
                marginBottom: "10px",
                color: "#222"
              }}
            >
              {partner.name}
            </h3>

            <p
              style={{
                fontSize: "15px",
                color: "#555",
                lineHeight: "1.6",
                marginBottom: "20px"
              }}
            >
              {partner.description}
            </p>

            <button
              onClick={() => window.open(partner.website, "_blank")}
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: "6px",
                background: "#007bff",
                color: "white",
                fontSize: "14px",
                cursor: "pointer",
                transition: "0.3s"
              }}
              onMouseOver={(e) => (e.target.style.background = "#0056b3")}
              onMouseOut={(e) => (e.target.style.background = "#007bff")}
            >
              Visit Website
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
