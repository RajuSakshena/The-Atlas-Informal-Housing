import geopandas as gpd
from sqlalchemy import create_engine

# GeoJSON file path
file_path = r"D:\slum project with dashboard\slum-impact-dashboard\src\data\boundary.json"

# read geojson
gdf = gpd.read_file(file_path)

# PostgreSQL + PostGIS connection
engine = create_engine(
    "postgresql://postgres:Mahadev%409212@localhost:5432/gis_dashboard"
)

# push to PostGIS
gdf.to_postgis(
    name="slum_boundaries",
    con=engine,
    if_exists="replace",
    index=False
)

print("✅ Data imported successfully")