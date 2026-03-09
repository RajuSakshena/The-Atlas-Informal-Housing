const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* -------------------------------
POSTGRES CONNECTION
-------------------------------- */

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "gis_dashboard",
  password: "Mahadev@9212",
  port: 5432,
});

/* -------------------------------
TEST ROUTE
-------------------------------- */

app.get("/", (req, res) => {
  res.send("GIS API running");
});

/* -------------------------------
GET ALL SLUM BOUNDARIES
-------------------------------- */

app.get("/api/boundary", async (req, res) => {
  console.log("API called: /api/boundary");

  try {

    const query = `
      SELECT
        "New_Slum_code" AS code,
        "Constituency" AS constituency,
        "Name" AS name,
        "Pre_post_95" AS prepost95,
        "Notification" AS notification,
        "Cluster" AS cluster,
        "Zone_no" AS zone,
        "Ward_No" AS ward,
        "Mouza" AS mouza,
        "Ownership as per 7/12" AS ownership,
        "Khasra_No" AS khasra,

        "Appx_Popu" AS population,
        "Appx_HH" AS households,
        "Appx_Area" AS area,
        "monthly_Income" AS income,

        "Total_Structure" AS structures,
        "Appx_Pucca" AS pucca,
        "Appx_Semi_pucca" AS "semiPucca",
        "Appx_Kaccha" AS kaccha,

        "piped_water" AS water,
        "Sewerage_network" AS sewerage,
        "strom_water_drain" AS drain,

        "Landuse" AS landuse,

        ST_AsGeoJSON(geometry)::json AS geometry

      FROM slum_boundaries
    `;

    const result = await pool.query(query);

    console.log("Rows fetched:", result.rows.length);

    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          code: row.code,
          constituency: row.constituency,
          name: row.name,
          prepost95: row.prepost95,
          notification: row.notification,
          cluster: row.cluster,
          zone: row.zone,
          ward: row.ward,
          mouza: row.mouza,
          ownership: row.ownership,
          khasra: row.khasra,

          population: row.population,
          households: row.households,
          area: row.area,
          income: row.income,

          structures: row.structures,
          pucca: row.pucca,
          semiPucca: row.semiPucca,
          kaccha: row.kaccha,

          water: row.water,
          sewerage: row.sewerage,
          drain: row.drain,

          landuse: row.landuse
        }
      }))
    };

    res.json(geojson);

  } catch (error) {

    console.error("DATABASE ERROR:", error);
    res.status(500).send("Error fetching boundary");

  }
});

/* -------------------------------
UPDATE GEOMETRY
-------------------------------- */

app.post("/api/update-boundary", async (req, res) => {

  const { code, geometry } = req.body;

  try {

    const query = `
      UPDATE slum_boundaries
      SET geometry = ST_SetSRID(ST_GeomFromGeoJSON($1),4326)
      WHERE "New_Slum_code" = $2
    `;

    await pool.query(query, [JSON.stringify(geometry), code]);

    res.json({
      success: true,
      message: "Boundary updated successfully"
    });

  } catch (error) {

    console.error("UPDATE ERROR:", error);
    res.status(500).send("Update failed");

  }

});

/* -------------------------------
SERVER START
-------------------------------- */

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});