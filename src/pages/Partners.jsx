import cfsd from "../images/cfsd.jpeg";
import tmi from "../images/TMI.png";

export default function Partners() {

  const partners = [

    {
      name: "Centre for Social Development (CFSD)",
      image: cfsd,
      description:
        "Centre for Social Development (CFSD) works towards inclusive urban and social development through research, capacity building, and community-based initiatives."
    },

    {
      name: "The Metropolitan Institute (TMI)",
      image: tmi,
      description:
        "The Metropolitan Institute (TMI) is a social impact think-and-do-tank that works at the confluence of government, civil society, and the market. TMI works on capacity building with government and non-profits, drives philanthropy and giving programs, builds and co-creates tech for good, and enables catalytic social impact environments across gender, climate, education, waste management, safety, local governance, and technology for social impact."
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
                lineHeight: "1.6"
              }}
            >
              {partner.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}