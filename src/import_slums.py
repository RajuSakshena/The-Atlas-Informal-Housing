import psycopg2
import json

# -------------------------
# LOCAL GEOJSON FILE PATH
# -------------------------
file_path = r"D:\slum project with dashboard\slum-impact-dashboard\src\data\boundary.json"

# -------------------------
# NEON DATABASE CONNECTION
# -------------------------
conn = psycopg2.connect(
"postgresql://neondb_owner:npg_rwf9inv5FaTW@ep-ancient-smoke-ado7kkmc-pooler.c-2.us-east-1.aws.neon.tech/gis_dashboard?sslmode=require"
)

cur = conn.cursor()

# -------------------------
# LOAD GEOJSON FILE
# -------------------------
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

count = 0

for feature in data["features"]:

    props = feature["properties"]
    geom = json.dumps(feature["geometry"])

    query = """
    INSERT INTO slum_boundaries (
    "New_Slum_code",
    "Constituency",
    "Name",
    "Pre_post_95",
    "Notification",
    "Cluster",
    "Zone_no",
    "Ward_No",
    "Mouza",
    "Ownership as per 7/12",
    "Khasra_No",
    "Appx_Popu",
    "Appx_HH",
    "Appx_Area",
    "monthly_Income",
    "Total_Structure",
    "Appx_Pucca",
    "Appx_Semi_pucca",
    "Appx_Kaccha",
    "piped_water",
    "Sewerage_network",
    "strom_water_drain",
    "Landuse",
    geometry
    )
    VALUES (
    %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
    %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
    ST_SetSRID(ST_GeomFromGeoJSON(%s),4326)
    )
    """

    values = (
        props.get("New_Slum_code"),
        props.get("Constituency"),
        props.get("Name"),
        props.get("Pre_post_95"),
        props.get("Notification"),
        props.get("Cluster"),
        props.get("Zone_no"),
        props.get("Ward_No"),
        props.get("Mouza"),
        props.get("Ownership as per 7/12"),
        props.get("Khasra_No"),
        props.get("Appx_Popu"),
        props.get("Appx_HH"),
        props.get("Appx_Area"),
        props.get("monthly_Income"),
        props.get("Total_Structure"),
        props.get("Appx_Pucca"),
        props.get("Appx_Semi_pucca"),
        props.get("Appx_Kaccha"),
        props.get("piped_water"),
        props.get("Sewerage_network"),
        props.get("strom_water_drain"),
        props.get("Landuse"),
        geom
    )

    cur.execute(query, values)
    count += 1

conn.commit()

print(f"✅ {count} slums imported successfully")

cur.close()
conn.close()