import { MapContainer as LeafletMapContainer, TileLayer, Polygon, Tooltip, Marker, useMapEvents } from "react-leaflet";
import { useRef, useState, useEffect } from "react";
import React from 'react';
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import boundary from "../data/boundary.json";

// Inject 3D style for boundaries
const style = document.createElement("style");
style.innerHTML = `
  .selected-boundary {
    filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.6));
  }
  .normal-boundary {
    filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
  }
`;
document.head.appendChild(style);

const locationIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  shadowSize: [57, 57]
});

const selectedLocationIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [40, 65],
  iconAnchor: [20, 65],
  shadowSize: [65, 65]
});

const fields = [
  { label: "New Slum Code", key: "New_Slum_code" },
  { label: "Constituency", key: "Constituency" },
  { label: "Name", key: "Name" },
  { label: "Pre Post 95", key: "Pre_post_95" },
  { label: "Notification", key: "Notification" },
  { label: "Cluster", key: "Cluster" },
  { label: "Zone No", key: "Zone_no" },
  { label: "Ward No", key: "Ward_No" },
  { label: "Mouza", key: "Mouza" },
  { label: "Ownership as per 7/12", key: "Ownership as per 7/12" },
  { label: "Khasra No", key: "Khasra_No" },
  { label: "Approx Population", key: "Appx_Popu" },
  { label: "Approx Households", key: "Appx_HH" },
  { label: "Approx Area", key: "Appx_Area" },
  { label: "Monthly Income", key: "monthly_Income" },
  { label: "Total Structures", key: "Total_Structure" },
  { label: "Approx Pucca", key: "Appx_Pucca" },
  { label: "Approx Semi-Pucca", key: "Appx_Semi_pucca" },
  { label: "Approx Kaccha", key: "Appx_Kaccha" },
  { label: "Piped Water", key: "piped_water" },
  { label: "Sewerage Network", key: "Sewerage_network" },
  { label: "Storm Water Drain", key: "strom_water_drain" },
  { label: "Land Use", key: "Landuse" }
];

export default function MapContainer() {
  const mapRef = useRef(null);
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const MAX_ZOOM = 22;
  const MARKER_HIDE_ZOOM = MAX_ZOOM - 1;
  const FOCUS_ZOOM = 16;

  const totalSlums = boundary?.features?.length || boundary?.length || 0;

  const features = boundary?.features || (Array.isArray(boundary) ? boundary : []);

  const filteredFeatures =
    selectedIndex !== null
      ? [features[selectedIndex]]
      : features;

  const mapFilteredFeatures =
    selectedIndex !== null
      ? [features[selectedIndex]]
      : features;

  const getFeatureLatLngBounds = (feature) => {
    const bounds = L.latLngBounds([]);
    const geometry = feature?.geometry;
    if (!geometry || !geometry.coordinates) return bounds;

    let rings = [];
    if (geometry.type === "Polygon") {
      rings = geometry.coordinates;
    } else if (geometry.type === "MultiPolygon") {
      rings = geometry.coordinates.flat();
    } else if (geometry.type === "Point") {
      const coords = geometry.coordinates;
      if (coords && coords.length === 2) {
        const [lng, lat] = coords;
        bounds.extend([lat, lng]);
      }
      return bounds;
    } else if (geometry.type === "MultiPoint") {
      const coords = geometry.coordinates;
      if (Array.isArray(coords)) {
        coords.forEach(([lng, lat]) => {
          if (typeof lng === "number" && typeof lat === "number") {
            bounds.extend([lat, lng]);
          }
        });
      }
      return bounds;
    } else {
      return bounds;
    }

    rings.forEach(ring => {
      if (Array.isArray(ring)) {
        ring.forEach(([lng, lat]) => {
          if (typeof lng === "number" && typeof lat === "number") {
            bounds.extend([lat, lng]);
          }
        });
      }
    });
    return bounds;
  };

  const handleSelect = (feature, index) => {
    setSelectedIndex(prev => (prev === index ? null : index));
  };

  const getCentroid = (feature) => {
    const geometry = feature?.geometry;
    if (!geometry || !geometry.coordinates) return [28.62, 77.20];

    const coords = geometry.coordinates;

    if (geometry.type === "Point") {
      const [lng, lat] = coords;
      return [lat, lng];
    }

    let ring;
    if (geometry.type === "Polygon") {
      ring = coords[0];
    } else if (geometry.type === "MultiPolygon") {
      ring = coords[0]?.[0];
    } else if (geometry.type === "MultiPoint") {
      const [lng, lat] = coords[0] || [77.20, 28.62];
      return [lat, lng];
    } else {
      return [28.62, 77.20];
    }

    if (!ring || !Array.isArray(ring)) return [28.62, 77.20];

    let sumLat = 0;
    let sumLng = 0;
    let count = 0;

    ring.forEach(([lng, lat]) => {
      if (typeof lng === "number" && typeof lat === "number") {
        sumLng += lng;
        sumLat += lat;
        count++;
      }
    });

    if (count === 0) return [28.62, 77.20];
    return [sumLat / count, sumLng / count];
  };

  useEffect(() => {
    if (selectedIndex === null || !mapRef.current || !features.length) return;
    const selectedFeature = features[selectedIndex];
    const geometry = selectedFeature?.geometry;
    if (!geometry) return;
    setTimeout(() => {
      if (!mapRef.current) return;
      if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
        let rings =
          geometry.type === "Polygon"
            ? geometry.coordinates
            : geometry.coordinates.flat();
        const bounds = L.latLngBounds(
          rings.flat().map(([lng, lat]) => [lat, lng])
        );
        mapRef.current.flyToBounds(bounds, {
          maxZoom: FOCUS_ZOOM,
          duration: 0.8
        });
      } else {
        const center = getCentroid(selectedFeature);
        mapRef.current.flyTo(center, FOCUS_ZOOM, {
          duration: 0.8
        });
      }
    }, 50);
  }, [selectedIndex, features]);

  const ZoomHandler = ({ setShowBoundaries }) => {
    const map = useMapEvents({
      zoomend: () => {
        setShowBoundaries(map.getZoom() >= MARKER_HIDE_ZOOM);
      },
    });

    useEffect(() => {
      setShowBoundaries(map.getZoom() >= MARKER_HIDE_ZOOM);
    }, [map]);

    return null;
  };

  const renderTooltipContent = (p) => {
    const leftFields = fields.slice(0, 12);
    const rightFields = fields.slice(12);

    return (
      <div style={{ width: "560px", padding: "8px", fontFamily: "system-ui, -apple-system, sans-serif", fontSize: "13px", lineHeight: "1.4", color: "#1f2937", background: "#ffffff", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "#7C3AED", marginBottom: "6px", paddingBottom: "6px", borderBottom: "1px solid #e5e7eb" }}>Slum Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0 8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "4px 8px", alignItems: "baseline", wordBreak: "break-word", overflowWrap: "break-word" }}>
            {leftFields.map(({ label, key }) => (
              <React.Fragment key={label}>
                <strong>{label}:</strong>
                <span>{p[key] ?? "N/A"}</span>
              </React.Fragment>
            ))}
          </div>
          <div style={{ backgroundColor: "#e5e7eb", width: "1px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "4px 8px", alignItems: "baseline", wordBreak: "break-word", overflowWrap: "break-word" }}>
            {rightFields.map(({ label, key }) => (
              <React.Fragment key={label}>
                <strong>{label}:</strong>
                <span>{p[key] ?? "N/A"}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMarker = (feature, index) => {
    const center = getCentroid(feature);
    const p = feature.properties || {};
    const isSelected = selectedIndex === index;
    return (
      <Marker
        key={index}
        position={center}
        icon={isSelected ? selectedLocationIcon : locationIcon}
        eventHandlers={{
          click: () => handleSelect(feature, index)
        }}
      >
        <Tooltip sticky direction="top" opacity={1} permanent={false} interactive={false}>
          {renderTooltipContent(p)}
        </Tooltip>
      </Marker>
    );
  };

  const renderBoundary = (feature, index) => {
    const geometry = feature?.geometry;
    if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return null;

    let positions;
    if (geometry.type === "Polygon") {
      positions = geometry.coordinates.map(ring => ring.map(([lng, lat]) => [lat, lng]));
    } else {
      positions = geometry.coordinates.map(poly => poly.map(ring => ring.map(([lng, lat]) => [lat, lng])));
    }

    const p = feature.properties || {};
    const isSelected = selectedIndex === index;

    return (
      <Polygon
        key={index}
        positions={positions}
        pane="overlayPane"
        pathOptions={{
          color: "#000000",
          weight: isSelected ? 6 : 4,
          fillColor: "#C4B5FD",
          fillOpacity: isSelected ? 0.55 : 0.45,
          interactive: true
        }}
        className={isSelected ? "selected-boundary" : "normal-boundary"}
        eventHandlers={{
          mouseover: (e) => e.target.openTooltip(),
          mousemove: (e) => e.target.openTooltip(),
          mouseout: (e) => e.target.closeTooltip(),
          click: () => handleSelect(feature, index)
        }}
      >
        <Tooltip sticky direction="top" opacity={1} permanent={false} interactive={false}>
          {renderTooltipContent(p)}
        </Tooltip>
      </Polygon>
    );
  };

  useEffect(() => {
    if (mapRef.current && features.length > 0) {
      const bounds = L.latLngBounds([]);
      features.forEach(feature => {
        const geometry = feature?.geometry;
        if (geometry && geometry.coordinates) {
          let rings = [];
          if (geometry.type === "Polygon") {
            rings = geometry.coordinates;
          } else if (geometry.type === "MultiPolygon") {
            rings = geometry.coordinates.flat();
          }
          rings.forEach(ring => {
            ring.forEach(([lng, lat]) => {
              bounds.extend([lat, lng]);
            });
          });
        }
      });
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [features]);

  const renderCard = () => {
    if (selectedIndex !== null) {
      const selectedFeature = features[selectedIndex];
      const p = selectedFeature?.properties || {};
      return (
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "32px 24px",
            borderRadius: "12px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05)",
            textAlign: "left",
          }}
        >
          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: "1.75rem",
              fontWeight: "700",
              color: "#1e2937",
            }}
          >
            Selected Slum
          </h2>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "600",
              color: "#7C3AED",
              marginBottom: "12px",
            }}
          >
            {p.Name ?? "N/A"}
          </div>
          <p style={{ margin: "4px 0" }}>Constituency: {p.Constituency ?? "N/A"}</p>
          <p style={{ margin: "4px 0" }}>Zone: {p.Zone_no ?? "N/A"}</p>
          <p style={{ margin: "4px 0" }}>Ward: {p.Ward_No ?? "N/A"}</p>
          <p style={{ margin: "4px 0" }}>Area: {p.Appx_Area ?? "N/A"}</p>
        </div>
      );
    } else {
      return (
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "32px 24px",
            borderRadius: "12px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05)",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: "1.75rem",
              fontWeight: "700",
              color: "#1e2937",
            }}
          >
            Total Slums
          </h2>
          <div
            style={{
              fontSize: "4.2rem",
              fontWeight: "800",
              color: "#7C3AED",
              lineHeight: "1",
            }}
          >
            {totalSlums}
          </div>
        </div>
      );
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%" }}>
      {/* Left Panel - 25% */}
      <div
        style={{
          width: "25%",
          backgroundColor: "#f8fafc",
          borderRight: "1px solid #e2e8f0",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
        }}
      >
        <div
          style={{
            padding: "24px 24px 0 24px",
          }}
        >
          {renderCard()}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 24px 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead style={{ background: "#f1f5f9", position: "sticky", top: 0 }}>
              <tr>
                <th style={{ padding: "8px", border: "1px solid #e2e8f0" }}>Name</th>
                <th style={{ padding: "8px", border: "1px solid #e2e8f0" }}>Constituency</th>
                <th style={{ padding: "8px", border: "1px solid #e2e8f0" }}>Zone_no</th>
                <th style={{ padding: "8px", border: "1px solid #e2e8f0" }}>Ward_No</th>
                <th style={{ padding: "8px", border: "1px solid #e2e8f0" }}>Appx_Area</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeatures.map((feature, mapIndex) => {
                const index = selectedIndex !== null ? selectedIndex : mapIndex;
                const p = feature.properties || {};
                return (
                  <tr
                    key={index}
                    onClick={() => handleSelect(feature, index)}
                    style={{
                      backgroundColor: selectedIndex === index ? "#ede9fe" : "transparent",
                      cursor: "pointer"
                    }}
                  >
                    <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>{p.Name ?? "N/A"}</td>
                    <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>{p.Constituency ?? "N/A"}</td>
                    <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>{p.Zone_no ?? "N/A"}</td>
                    <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>{p.Ward_No ?? "N/A"}</td>
                    <td style={{ padding: "8px", border: "1px solid #e2e8f0" }}>{p.Appx_Area ?? "N/A"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Side - 75% Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <LeafletMapContainer
          center={[28.62, 77.20]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => {
            mapRef.current = map;
          }}
          maxZoom={MAX_ZOOM}
          minZoom={10}
        >
          <TileLayer
            attribution='Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={19}
            maxZoom={MAX_ZOOM}
            tileSize={256}
            updateWhenZooming={false}
          />
          <ZoomHandler setShowBoundaries={setShowBoundaries} />
          {mapFilteredFeatures.map((feature, mapIndex) => {
            const index =
              selectedIndex !== null
                ? selectedIndex
                : mapIndex;
            return showBoundaries
              ? renderBoundary(feature, index)
              : renderMarker(feature, index);
          })}
        </LeafletMapContainer>
      </div>
    </div>
  );
}