import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MapContainer as LeafletMapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { renderToStaticMarkup } from "react-dom/server";

function getCentroid(feature) {
  const geometry = feature?.geometry;
  if (!geometry?.coordinates) return null;
  const bounds = L.latLngBounds([]);
  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach(ring => {
      ring.forEach(([lng, lat]) => {
        bounds.extend([lat, lng]);
      });
    });
  }
  if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach(polygon => {
      polygon.forEach(ring => {
        ring.forEach(([lng, lat]) => {
          bounds.extend([lat, lng]);
        });
      });
    });
  }
  if (!bounds.isValid()) return null;
  const center = bounds.getCenter();
  return [center.lat, center.lng];
}

function renderTooltipContent(p) {
  const jsx = (
    <div style={{ 
      maxWidth: "560px", 
      padding: "14px", 
      fontFamily: "system-ui, -apple-system, sans-serif", 
      fontSize: "13px", 
      lineHeight: "1.55", 
      color: "#1f2937", 
      background: "#ffffff", 
      borderRadius: "10px", 
      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.15)", 
      border: "1px solid #e5e7eb",
      columnCount: 2,
      columnGap: "28px",
      columnRule: "1px solid #e5e7eb"
    }}>
      <div><strong>Code:</strong> {p.code ?? "N/A"}</div>
      <div><strong>Name:</strong> {p.name ?? "N/A"}</div>
      <div><strong>Cluster:</strong> {p.cluster ?? "N/A"}</div>
      <div><strong>Zone:</strong> {p.zone ?? "N/A"}</div>
      <div><strong>Ward:</strong> {p.ward ?? "N/A"}</div>
      <div><strong>Mouza:</strong> {p.mouza ?? "N/A"}</div>
      <div><strong>Khasra:</strong> {p.khasra ?? "N/A"}</div>
      <div><strong>Constituency:</strong> {p.constituency ?? "N/A"}</div>
      <div><strong>Pre Post 95:</strong> {p.prepost95 ?? "N/A"}</div>
      <div><strong>Notification:</strong> {p.notification ?? "N/A"}</div>
      <div><strong>Ownership:</strong> {p.ownership ?? "N/A"}</div>
      <div><strong>Population:</strong> {p.population ?? 0}</div>
      <div><strong>Households:</strong> {p.households ?? 0}</div>
      <div><strong>Area:</strong> {p.area ?? "N/A"}</div>
      <div><strong>Income:</strong> ₹{(p.income ?? 0).toLocaleString()}</div>
      <div><strong>Total Structures:</strong> {p.structures ?? 0}</div>
      <div><strong>Pucca Structures:</strong> {p.pucca ?? 0}</div>
      <div><strong>Semi Pucca Structures:</strong> {p.Appx_Semi_pucca ?? 0}</div>
      <div><strong>Kaccha Structures:</strong> {p.kaccha ?? 0}</div>
      <div><strong>Piped Water:</strong> {p.water ?? "N/A"}</div>
      <div><strong>Sewerage:</strong> {p.sewerage ?? "N/A"}</div>
      <div><strong>Storm Drain:</strong> {p.drain ?? "N/A"}</div>
      <div><strong>Landuse:</strong> {p.landuse ?? "N/A"}</div>
    </div>
  );
  return renderToStaticMarkup(jsx);
}

const getVulnColor = (score) => {
  if (score >= 4) return "#ef4444";
  if (score >= 2) return "#f59e0b";
  return "#22c55e";
};

const getMarkerIcon = (score) => {
  let color = "green";
  if (score >= 4) color = "red";
  else if (score >= 2) color = "orange";
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [35, 57],
    iconAnchor: [17, 57],
    shadowSize: [57, 57]
  });
};

const MapInitializer = ({ setMap }) => {
  const map = useMap();
  useEffect(() => {
    setMap(map);
  }, [map, setMap]);
  return null;
};

export default function Home() {
  const [mapInstance, setMapInstance] = useState(null);
  const markersListRef = useRef([]);
  const heatLayerRef = useRef(null);
  const geoJsonRef = useRef(null);
  const editableFeatureGroupRef = useRef(L.featureGroup());
  const [isMobile, setIsMobile] = useState(false);
  const [city, setCity] = useState("Delhi");
  const [boundaryData, setBoundaryData] = useState(null);
  const [boundaryVersion, setBoundaryVersion] = useState(0);
  const [filters, setFilters] = useState({
    constituency: "",
    zone: "",
    prePost: "",
    hasPiped: false,
    hasSewer: false,
    hasStorm: false
  });
  const [selectedCode, setSelectedCode] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "Vuln", direction: "desc" });
  const [showMarkers, setShowMarkers] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 10;

  useEffect(() => {
    fetch("https://slum-impact-backend.onrender.com/api/boundary")
      .then((res) => res.json())
      .then((data) => setBoundaryData(data))
      .catch((err) => console.error("Failed to fetch boundaries:", err));
  }, []);

  const features = boundaryData?.features || (Array.isArray(boundaryData) ? boundaryData : []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const globalAvgIncome = useMemo(() => {
    if (!features.length) return 0;
    const sum = features.reduce((acc, f) => acc + (f.properties?.income || 0), 0);
    return sum / features.length;
  }, [features]);

  const calculateVuln = useCallback((p) => {
    if (!p) return 0;
    let score = 0;
    if (p.water === "No") score++;
    if (p.sewerage === "No") score++;
    if ((p.kaccha || 0) > (p.pucca || 0)) score++;
    if ((p.income || 0) < globalAvgIncome) score++;
    return score;
  }, [globalAvgIncome]);

  const parseArea = useCallback((str) => {
    if (typeof str !== "string") return 0;
    const match = str.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }, []);

  const filteredFeatures = useMemo(() => {
    return features.filter((f) => {
      const p = f.properties || {};
      if (filters.constituency && p.constituency !== filters.constituency) return false;
      if (filters.zone && String(p.zone || "") !== filters.zone) return false;
      if (filters.prePost && p.prepost95 !== filters.prePost) return false;
      if (filters.hasPiped && !["Yes", "Partial"].includes(p.water || "")) return false;
      if (filters.hasSewer && p.sewerage !== "Yes") return false;
      if (filters.hasStorm && p.drain !== "Yes") return false;
      return true;
    });
  }, [features, filters]);

  const geoJsonData = useMemo(() => ({
    type: "FeatureCollection",
    features: filteredFeatures
  }), [filteredFeatures]);

  const getPolygonStyle = useCallback((feature) => {
    const p = feature.properties || {};
    const score = calculateVuln(p);
    const isSelected = p.code === selectedCode;
    return {
      color: isSelected ? "#7C3AED" : "#1f2937",
      weight: isSelected ? 6 : 4,
      dashArray: isSelected && isEditing ? "6, 6" : null,
      fillColor: getVulnColor(score),
      fillOpacity: isSelected ? 0.65 : 0.48
    };
  }, [calculateVuln, selectedCode, isEditing]);

  const onEachFeatureHandler = useCallback((feature, layer) => {
    const p = feature.properties || {};
    const tooltipHtml = renderTooltipContent(p);
    // Disable tooltip during editing to prevent interference with vertex dragging
    if (!(isEditing && p.code === selectedCode)) {
      layer.bindTooltip(tooltipHtml, {
        sticky: true,
        opacity: 1
      });
    }
    layer.on({
      click: () => {
        setSelectedCode(p.code);
        setIsEditing(false);
      },
      mouseover: (e) => {
        if (!isEditing) {
          e.target.setStyle({
            weight: 5,
            fillOpacity: 0.65
          });
          e.target.openTooltip(e.latlng);
        }
      },
      mouseout: (e) => {
        e.target.resetStyle();
      }
    });
  }, [setSelectedCode, isEditing, selectedCode]);

  const uniqueConstituencies = useMemo(() => {
    return [...new Set(features.map((f) => f.properties?.constituency).filter(Boolean))].sort();
  }, [features]);

  const uniqueZones = useMemo(() => {
    return [...new Set(features.map((f) => String(f.properties?.zone || "")).filter(Boolean))].sort();
  }, [features]);

  const uniquePrePosts = useMemo(() => {
    return [...new Set(features.map((f) => f.properties?.prepost95).filter(Boolean))].sort();
  }, [features]);

  const kpis = useMemo(() => {
    let totalPopu = 0, totalHH = 0, sumIncome = 0, totalStruct = 0, sumArea = 0;
    let pipedC = 0, sewerC = 0, stormC = 0;
    const count = filteredFeatures.length;
    filteredFeatures.forEach((f) => {
      const p = f.properties || {};
      totalPopu += p.population || 0;
      totalHH += p.households || 0;
      sumIncome += p.income || 0;
      totalStruct += p.structures || 0;
      sumArea += parseArea(p.area);
      if (["Yes", "Partial"].includes(p.water)) pipedC++;
      if (p.sewerage === "Yes") sewerC++;
      if (p.drain === "Yes") stormC++;
    });
    const avgInc = count ? Math.round(sumIncome / count) : 0;
    const pPct = count ? Math.round((pipedC / count) * 100) : 0;
    const sPct = count ? Math.round((sewerC / count) * 100) : 0;
    const stPct = count ? Math.round((stormC / count) * 100) : 0;
    return {
      totalSlums: count,
      totalPopu,
      totalHH,
      avgIncome: avgInc,
      totalStructures: totalStruct,
      totalArea: Math.round(sumArea),
      pipedPct: pPct,
      sewerPct: sPct,
      stormPct: stPct
    };
  }, [filteredFeatures, parseArea]);

  const constituencyData = useMemo(() => {
    const counts = {};
    filteredFeatures.forEach((f) => {
      const key = f.properties?.constituency || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredFeatures]);

  const zoneData = useMemo(() => {
    const counts = {};
    filteredFeatures.forEach((f) => {
      const key = String(f.properties?.zone || "Unknown");
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredFeatures]);

  const prePostData = useMemo(() => {
    const counts = {};
    filteredFeatures.forEach((f) => {
      const key = f.properties?.prepost95 || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredFeatures]);

  const landuseData = useMemo(() => {
    const counts = {};
    filteredFeatures.forEach((f) => {
      const key = f.properties?.landuse || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredFeatures]);

  const sortedTableFeatures = useMemo(() => {
    let sorted = [...filteredFeatures];
    if (!sortConfig.key) return sorted;
    sorted.sort((a, b) => {
      const pa = a.properties || {};
      const pb = b.properties || {};
      let va, vb;
      if (sortConfig.key === "Vuln") {
        va = calculateVuln(pa);
        vb = calculateVuln(pb);
      } else if (sortConfig.key === "Density") {
        const areaA = parseArea(pa.area);
        va = areaA > 0 ? (pa.population || 0) / areaA : 0;
        const areaB = parseArea(pb.area);
        vb = areaB > 0 ? (pb.population || 0) / areaB : 0;
      } else {
        va = pa[sortConfig.key] ?? "";
        vb = pb[sortConfig.key] ?? "";
        if (!isNaN(parseFloat(va)) && !isNaN(parseFloat(vb))) {
          va = parseFloat(va);
          vb = parseFloat(vb);
        }
      }
      if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredFeatures, sortConfig, calculateVuln, parseArea]);

  const totalPages = useMemo(() => Math.ceil(sortedTableFeatures.length / rowsPerPage), [sortedTableFeatures.length]);

  const paginatedTableFeatures = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedTableFeatures.slice(start, start + rowsPerPage);
  }, [sortedTableFeatures, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortConfig.key, sortConfig.direction, filteredFeatures.length]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const handleRowClick = useCallback((code) => {
    setSelectedCode((prev) => prev === code ? null : code);
    setIsEditing(false);
  }, []);

  const sortIndicator = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  const exportToExcel = () => {
    const exportData = sortedTableFeatures.map((f) => {
      const p = f.properties || {};
      const score = calculateVuln(p);
      const area = parseArea(p.area);
      const density = area > 0 ? (p.population / area).toFixed(2) : 0;
      return {
        "Code": p.code,
        Name: p.name,
        Constituency: p.constituency,
        Zone: p.zone,
        Population: p.population,
        Households: p.households,
        "Area (gaj)": p.area,
        "Monthly Income": p.income,
        Density: density,
        "Vulnerability Score": score,
        "Piped Water": p.water,
        Sewerage: p.sewerage,
        "Storm Drain": p.drain
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Slums");
    XLSX.writeFile(wb, `Delhi_Slums_Analysis_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    let y = 25;
    doc.setFontSize(20);
    doc.text("Delhi Slum GIS Analytical Dashboard", 105, y, { align: "center" });
    y += 12;
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 20, y);
    y += 10;
    doc.text(`Total Slums: ${kpis.totalSlums}`, 20, y);
    y += 8;
    doc.text(`Total Population: ${kpis.totalPopu.toLocaleString()}`, 20, y);
    y += 8;
    doc.text(`Avg Monthly Income: ₹${kpis.avgIncome}`, 20, y);
    y += 8;
    doc.text(`Infrastructure Coverage: Piped ${kpis.pipedPct}% | Sewerage ${kpis.sewerPct}% | Storm ${kpis.stormPct}%`, 20, y);
    y += 15;
    doc.text("Top 5 Most Vulnerable Slums:", 20, y);
    y += 8;
    const topVuln = sortedTableFeatures.slice(0, 5).map((f, i) => {
      const p = f.properties || {};
      return `${i + 1}. ${p.name || "N/A"} (Score: ${calculateVuln(p)})`;
    }).join("\n");
    doc.text(topVuln, 20, y);
    doc.save(`Slum_Dashboard_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const getFeatureLatLngBounds = (feature) => {
    const bounds = L.latLngBounds([]);
    const geometry = feature?.geometry;
    if (!geometry || !geometry.coordinates) return bounds;
    if (geometry.type === "Point") {
      const [lng, lat] = geometry.coordinates;
      bounds.extend([lat, lng]);
      return bounds;
    }
    let rings = [];
    if (geometry.type === "Polygon") rings = geometry.coordinates;
    else if (geometry.type === "MultiPolygon") rings = geometry.coordinates.flat();
    rings.forEach((ring) => {
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

  // Individual markers
  useEffect(() => {
    if (!mapInstance) return;

    markersListRef.current.forEach((m) => mapInstance.removeLayer(m));
    markersListRef.current = [];

    if (!showMarkers) return;

    filteredFeatures.forEach((feature) => {
      const p = feature.properties || {};
      const score = calculateVuln(p);
      const center = getCentroid(feature);
      if (!center) return;

      let marker;
      try {
        marker = L.marker(center, { icon: getMarkerIcon(score) });
      } catch {
        marker = L.marker(center);
      }

      marker.bindTooltip(renderTooltipContent(p), { sticky: true, opacity: 1 });
      marker.addTo(mapInstance);
      markersListRef.current.push(marker);
    });
  }, [mapInstance, showMarkers, filteredFeatures, calculateVuln]);

  // Heatmap
  useEffect(() => {
    if (!mapInstance) return;

    if (heatLayerRef.current) {
      mapInstance.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (!showHeatmap) return;

    const loadHeatLayer = async () => {
      await import("leaflet.heat");
      if (!L.heatLayer) return;
      const heatPoints = filteredFeatures
        .map((feature) => {
          const center = getCentroid(feature);
          if (!center) return null;
          const score = calculateVuln(feature.properties || {});
          return [...center, score / 10];
        })
        .filter(Boolean);

      const heatLayerInstance = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 20,
        maxZoom: 22
      });
      heatLayerInstance.addTo(mapInstance);
      heatLayerRef.current = heatLayerInstance;
    };

    loadHeatLayer();
  }, [mapInstance, showHeatmap, filteredFeatures, calculateVuln]);

  // Auto-fit
  useEffect(() => {
    if (!mapInstance || filteredFeatures.length === 0) return;
    const bounds = L.latLngBounds([]);
    filteredFeatures.forEach((f) => {
      const b = getFeatureLatLngBounds(f);
      if (b.isValid()) bounds.extend(b);
    });
    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [mapInstance, filteredFeatures]);

  // Fly to selected
  useEffect(() => {
    if (!mapInstance || !selectedCode) return;
    const feat = filteredFeatures.find((f) => f.properties?.code === selectedCode);
    if (!feat) return;
    const bounds = getFeatureLatLngBounds(feat);
    if (bounds.isValid() && (feat.geometry?.type === "Polygon" || feat.geometry?.type === "MultiPolygon")) {
      mapInstance.flyToBounds(bounds, { maxZoom: 18, duration: 1 });
    } else {
      const center = getCentroid(feat) || [28.62, 77.20];
      mapInstance.flyTo(center, 18, { duration: 1 });
    }
  }, [mapInstance, selectedCode, filteredFeatures]);

  // Add editableFeatureGroup to map when mapInstance loads
  useEffect(() => {
    if (mapInstance && editableFeatureGroupRef.current) {
      mapInstance.addLayer(editableFeatureGroupRef.current);
    }
    return () => {
      if (mapInstance && editableFeatureGroupRef.current) {
        mapInstance.removeLayer(editableFeatureGroupRef.current);
      }
    };
  }, [mapInstance]);

  // Setup Leaflet Draw control
  useEffect(() => {
    if (!mapInstance) return;

    if (mapInstance._drawControl) {
      mapInstance.removeControl(mapInstance._drawControl);
    }

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: false,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: editableFeatureGroupRef.current,
        remove: false,
      },
    });

    mapInstance.addControl(drawControl);
    mapInstance._drawControl = drawControl;

    return () => {
      if (mapInstance._drawControl) {
        mapInstance.removeControl(mapInstance._drawControl);
        delete mapInstance._drawControl;
      }
    };
  }, [mapInstance]);

  // Sync ONLY the selected polygon into editable feature group when editing is active
  useEffect(() => {
    const group = editableFeatureGroupRef.current;
    if (!group || !geoJsonRef.current) return;

    group.clearLayers();

    if (!isEditing || !selectedCode || !mapInstance) return;

    const layers = geoJsonRef.current.getLayers();
    if (!layers || !Array.isArray(layers)) {
      console.warn("GeoJSON layers not available");
      return;
    }

    const selectedLayer = layers.find(layer => 
      layer.feature && layer.feature.properties && layer.feature.properties.code === selectedCode
    );

    if (!selectedLayer) {
      console.warn(`No layer found for code: ${selectedCode}`);
      return;
    }

    const selectedFeature = selectedLayer.feature;
    const { geometry, properties } = selectedFeature;
    const style = { color: "#7C3AED", weight: 6, dashArray: "6,6" };

    let layersAdded = false;

    if (geometry.type === "Polygon") {
      const coords = geometry.coordinates;
      try {
        const latLngs = coords.map(ring => ring.map(([lng, lat]) => [lat, lng]));
        const polygon = L.polygon(latLngs, style);
        const singleGeom = { type: "Polygon", coordinates: coords };
        polygon.feature = { type: "Feature", properties: { ...properties }, geometry: singleGeom };
        const bounds = polygon.getBounds();
        if (bounds.isValid()) {
          group.addLayer(polygon);
          layersAdded = true;
        } else {
          console.warn(`Invalid bounds for polygon (code: ${selectedCode})`);
        }
      } catch (error) {
        console.warn(`Error creating polygon layer (code: ${selectedCode}):`, error);
      }
    } else if (geometry.type === "MultiPolygon") {
      geometry.coordinates.forEach((polyCoords, index) => {
        try {
          const latLngs = polyCoords.map(ring => ring.map(([lng, lat]) => [lat, lng]));
          const polygon = L.polygon(latLngs, style);
          const singleGeom = { type: "Polygon", coordinates: polyCoords };
          polygon.feature = { type: "Feature", properties: { ...properties }, geometry: singleGeom };
          const bounds = polygon.getBounds();
          if (bounds.isValid()) {
            group.addLayer(polygon);
            layersAdded = true;
          } else {
            console.warn(`Invalid bounds for multi polygon part ${index} (code: ${selectedCode})`);
          }
        } catch (error) {
          console.warn(`Error creating polygon layer for multi part ${index} (code: ${selectedCode}):`, error);
        }
      });
    } else {
      console.warn(`Unsupported geometry type: ${geometry.type} (code: ${selectedCode})`);
    }

    if (layersAdded) {
      group.eachLayer((layer) => {
        if (layer.editing && layer.editing.enable) {
          layer.editing.enable();
        }
      });
      mapInstance.fire("draw:editstart");
    }
  }, [isEditing, selectedCode, mapInstance]);

  // Reset editing when selection changes
  useEffect(() => {
    setIsEditing(false);
  }, [selectedCode]);

  // Edit Boundary button handler
  const handleStartEditing = () => {
    if (!selectedCode || !mapInstance) return;
    setIsEditing(true);
  };

  // Save Boundary button handler
  const handleSaveBoundary = () => {
    if (!selectedCode || !mapInstance) return;

    const group = editableFeatureGroupRef.current;
    let editedLayers = [];
    group.eachLayer((layer) => {
      if (layer.feature && layer.feature.properties && layer.feature.properties.code === selectedCode) {
        editedLayers.push(layer);
      }
    });

    if (editedLayers.length === 0) {
      alert("No edited layer found");
      return;
    }

    const geometries = editedLayers.map(layer => layer.toGeoJSON().geometry);

    let geometry;
    if (geometries.length === 1) {
      geometry = geometries[0];
    } else {
      geometry = {
        type: "MultiPolygon",
        coordinates: geometries.map(g => g.coordinates)
      };
    }

    fetch("https://slum-impact-backend.onrender.com/api/update-boundary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: selectedCode, geometry }),
    })
      .then((res) => {
        if (res.ok) {
          alert("Boundary saved");
          fetch("https://slum-impact-backend.onrender.com/api/boundary")
            .then((r) => r.json())
            .then((data) => {
              setBoundaryData(data);
              setBoundaryVersion((v) => v + 1); // Force GeoJSON remount with new data
              setIsEditing(false);
            })
            .catch((err) => console.error(err));
        } else {
          alert("Failed to save boundary");
        }
      })
      .catch((err) => {
        console.error(err);
        alert("Save failed");
      });
  };

  // Cancel editing
  const handleCancelEditing = () => {
    setIsEditing(false);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (markersListRef.current.length && mapInstance) {
        markersListRef.current.forEach((m) => mapInstance.removeLayer(m));
        markersListRef.current = [];
      }
      if (heatLayerRef.current && mapInstance) {
        mapInstance.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [mapInstance]);

  const KpiCard = ({ label, value, color = "#1e2937" }) => (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", padding: "20px 24px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", border: "1px solid #f1f5f9" }}>
      <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "700", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "29px", fontWeight: "700", color }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>
      {city === "Delhi" && (
        <section style={{ padding: "22px 32px 18px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: "18px" }}>
            <KpiCard label="Total Designated Slum Areas" value={kpis.totalSlums} color="#7C3AED" />
            <KpiCard label="Total Population Dwelling in these Areas" value={kpis.totalPopu.toLocaleString()} color="#7C3AED" />
            <KpiCard label="Total Formalised Houses" value={kpis.totalHH.toLocaleString()} color="#7C3AED" />
            <KpiCard label="Avg Monthly Income" value={`₹${kpis.avgIncome.toLocaleString()}`} color="#7C3AED" />
            <KpiCard label="Total Houses" value={kpis.totalStructures.toLocaleString()} color="#7C3AED" />
            <KpiCard label="Total Area (gaj)" value={kpis.totalArea.toLocaleString()} color="#7C3AED" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: "18px", marginTop: "18px" }}>
            <KpiCard label="Piped Water" value={`${kpis.pipedPct}%`} color="#10b981" />
            <KpiCard label="Sewerage Network" value={`${kpis.sewerPct}%`} color="#10b981" />
            <KpiCard label="Storm Water Drain" value={`${kpis.stormPct}%`} color="#10b981" />
          </div>
        </section>
      )}

      <section style={{ padding: "0 32px", backgroundColor: "#f8fafc" }}>
        <div style={{ 
          display: "flex", 
          gap: "24px", 
          flexDirection: isMobile ? "column" : "row", 
          height: isMobile ? "auto" : "80vh" 
        }}>
          <div style={{ 
            width: isMobile ? "100%" : "20%", 
            minWidth: isMobile ? "auto" : "240px", 
            backgroundColor: "#f8fafc", 
            borderRadius: "12px", 
            padding: "26px", 
            overflowY: "auto", 
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
              <h3 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#1e2937" }}>Filters</h3>
              <button
                onClick={() => setFilters({ constituency: "", zone: "", prePost: "", hasPiped: false, hasSewer: false, hasStorm: false })}
                style={{ padding: "7px 18px", fontSize: "13px", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: "7px", cursor: "pointer", fontWeight: 500 }}
              >
                Reset
              </button>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13.5px", fontWeight: 600, marginBottom: "7px", color: "#475569" }}>City</div>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff" }}
              >
                <option value="Delhi">Delhi</option>
                <option value="Nagpur">Nagpur</option>
              </select>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13.5px", fontWeight: 600, marginBottom: "7px", color: "#475569" }}>Constituency</div>
              <select
                value={filters.constituency}
                onChange={(e) => setFilters({ ...filters, constituency: e.target.value })}
                style={{ width: "100%", padding: "11px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff" }}
              >
                <option value="">All</option>
                {uniqueConstituencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13.5px", fontWeight: 600, marginBottom: "7px", color: "#475569" }}>Zone</div>
              <select
                value={filters.zone}
                onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                style={{ width: "100%", padding: "11px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff" }}
              >
                <option value="">All</option>
                {uniqueZones.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "26px" }}>
              <div style={{ fontSize: "13.5px", fontWeight: 600, marginBottom: "7px", color: "#475569" }}>Pre / Post 1995</div>
              <select
                value={filters.prePost}
                onChange={(e) => setFilters({ ...filters, prePost: e.target.value })}
                style={{ width: "100%", padding: "11px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff" }}
              >
                <option value="">All</option>
                {uniquePrePosts.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "13.5px", fontWeight: 600, marginBottom: "10px", color: "#475569" }}>Infrastructure</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer" }}>
                  <input type="checkbox" checked={filters.hasPiped} onChange={(e) => setFilters({ ...filters, hasPiped: e.target.checked })} style={{ accentColor: "#7C3AED", width: "17px", height: "17px" }} />
                  Piped Water
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer" }}>
                  <input type="checkbox" checked={filters.hasSewer} onChange={(e) => setFilters({ ...filters, hasSewer: e.target.checked })} style={{ accentColor: "#7C3AED", width: "17px", height: "17px" }} />
                  Sewerage
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer" }}>
                  <input type="checkbox" checked={filters.hasStorm} onChange={(e) => setFilters({ ...filters, hasStorm: e.target.checked })} style={{ accentColor: "#7C3AED", width: "17px", height: "17px" }} />
                  Storm Drain
                </label>
              </div>
            </div>
          </div>

          {city === "Delhi" ? (
            <div style={{ 
              flex: 1, 
              height: isMobile ? "60vh" : "100%", 
              position: "relative", 
              borderRadius: "12px", 
              overflow: "hidden", 
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.12)" 
            }}>
              <div style={{ height: "100%", width: "100%" }}>
                <LeafletMapContainer
                  center={[28.62, 77.20]}
                  zoom={12}
                  style={{ height: "100%", width: "100%" }}
                  maxZoom={22}
                  minZoom={10}
                >
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles © Esri"
                    maxZoom={22}
                    maxNativeZoom={18}
                  />
                  <MapInitializer setMap={setMapInstance} />

                  {showBoundaries && boundaryData && (
                    <GeoJSON
                      ref={geoJsonRef}
                      key={`geojson-layer-${boundaryVersion}`}
                      data={geoJsonData}
                      style={getPolygonStyle}
                      onEachFeature={onEachFeatureHandler}
                    />
                  )}
                </LeafletMapContainer>
              </div>

              {/* Floating Edit / Save buttons */}
              {selectedCode && (
                <div style={{ 
                  position: "absolute", 
                  bottom: "30px", 
                  left: "30px", 
                  zIndex: 1001, 
                  display: "flex", 
                  gap: "12px",
                  background: "#fff",
                  padding: "8px",
                  borderRadius: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.15)",
                  border: "1px solid #e2e8f0"
                }}>
                  {!isEditing ? (
                    <button 
                      onClick={handleStartEditing}
                      style={{ 
                        padding: "12px 24px", 
                        background: "#7C3AED", 
                        color: "#fff", 
                        border: "none", 
                        borderRadius: "8px", 
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "14px"
                      }}
                    >
                      ✏️ Edit Boundary
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={handleSaveBoundary}
                        style={{ 
                          padding: "12px 24px", 
                          background: "#10b981", 
                          color: "#fff", 
                          border: "none", 
                          borderRadius: "8px", 
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "14px"
                        }}
                      >
                        💾 Save Boundary
                      </button>
                      <button 
                        onClick={handleCancelEditing}
                        style={{ 
                          padding: "12px 24px", 
                          background: "#ef4444", 
                          color: "#fff", 
                          border: "none", 
                          borderRadius: "8px", 
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "14px"
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}

              <div style={{ position: "absolute", top: "22px", right: "22px", zIndex: 1000, background: "#fff", padding: "14px 18px", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", gap: "11px", fontSize: "13.8px", border: "1px solid #e2e8f0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer" }}>
                  <input type="checkbox" checked={showMarkers} onChange={(e) => setShowMarkers(e.target.checked)} /> Individual Markers
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer" }}>
                  <input type="checkbox" checked={showBoundaries} onChange={(e) => setShowBoundaries(e.target.checked)} /> Boundaries
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer" }}>
                  <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} /> Heatmap
                </label>
              </div>
            </div>
          ) : (
            <div style={{ 
              flex: 1, 
              height: isMobile ? "60vh" : "100%", 
              position: "relative", 
              borderRadius: "12px", 
              overflow: "hidden", 
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.12)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              backgroundColor: "#f8fafc" 
            }}>
              <div style={{ textAlign: "center", fontSize: "24px", fontWeight: "700", color: "#1e2937" }}>
                Nagpur Dashboard – Coming Soon
              </div>
            </div>
          )}
        </div>
      </section>

      {city === "Delhi" && (
        <section style={{ padding: "0 32px 40px", backgroundColor: "#f8fafc" }}>
          <div style={{ padding: "24px 0", backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#1e2937" }}>Slum Ranking &amp; Vulnerability Table</h2>
              <p style={{ margin: "5px 0 0", fontSize: "13.5px", color: "#64748b" }}>Sorted by Vulnerability • Click row to locate on map</p>
            </div>
            <div style={{ display: "flex", gap: "14px" }}>
              <button onClick={exportToExcel} style={{ padding: "11px 26px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: "9px", fontWeight: 600, cursor: "pointer", boxShadow: "0 3px 8px rgba(124,58,237,0.25)" }}>Export to Excel</button>
              <button onClick={downloadPDF} style={{ padding: "11px 26px", background: "#334155", color: "#fff", border: "none", borderRadius: "9px", fontWeight: 600, cursor: "pointer" }}>Download PDF</button>
            </div>
          </div>
          <div style={{ overflowX: "auto", marginTop: "24px" }}>
            <table style={{ width: "100%", minWidth: "1150px", borderCollapse: "collapse", fontSize: "13.6px" }}>
              <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 30 }}>
                <tr style={{ borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "16px 18px", textAlign: "left", fontWeight: 600, color: "#475569", cursor: "pointer" }} onClick={() => handleSort("name")}>Slum Name{sortIndicator("name")}</th>
                  <th style={{ padding: "16px 18px", textAlign: "left", fontWeight: 600, color: "#475569", cursor: "pointer" }} onClick={() => handleSort("constituency")}>Constituency{sortIndicator("constituency")}</th>
                  <th style={{ padding: "16px 18px", textAlign: "left", fontWeight: 600, color: "#475569", cursor: "pointer" }} onClick={() => handleSort("zone")}>Zone{sortIndicator("zone")}</th>
                  <th style={{ padding: "16px 18px", textAlign: "left", fontWeight: 600, color: "#475569", cursor: "pointer" }} onClick={() => handleSort("population")}>Population{sortIndicator("population")}</th>
                  <th style={{ padding: "16px 18px", textAlign: "left", fontWeight: 600, color: "#475569", cursor: "pointer" }} onClick={() => handleSort("households")}>Households{sortIndicator("households")}</th>
                  <th style={{ padding: "16px 18px", textAlign: "left", fontWeight: 600, color: "#475569", cursor: "pointer" }} onClick={() => handleSort("area")}>Area (gaj){sortIndicator("area")}</th>
                  <th style={{ padding: "16px 18px", textAlign: "left", fontWeight: 600, color: "#475569", cursor: "pointer" }} onClick={() => handleSort("income")}>Income (₹){sortIndicator("income")}</th>
                  <th style={{ padding: "16px 18px", textAlign: "left", fontWeight: 600, color: "#475569", cursor: "pointer" }} onClick={() => handleSort("Density")}>Density{sortIndicator("Density")}</th>
                  <th style={{ padding: "16px 18px", textAlign: "left", fontWeight: 600, color: "#475569", cursor: "pointer" }} onClick={() => handleSort("Vuln")}>Vuln Score{sortIndicator("Vuln")}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTableFeatures.map((feature, localIndex) => {
                  const p = feature.properties || {};
                  const score = calculateVuln(p);
                  const areaN = parseArea(p.area);
                  const density = areaN > 0 ? (p.population / areaN).toFixed(2) : "0.00";
                  const isSelected = p.code === selectedCode;
                  const globalIndex = (currentPage - 1) * rowsPerPage + localIndex;
                  return (
                    <tr
                      key={p.code}
                      onClick={() => handleRowClick(p.code)}
                      style={{
                        cursor: "pointer",
                        backgroundColor: isSelected ? "#f3e8ff" : "transparent",
                        transition: "background-color 0.15s"
                      }}
                    >
                      <td style={{ padding: "15px 18px", borderBottom: "1px solid #f1f5f9" }}>{p.name ?? "N/A"}</td>
                      <td style={{ padding: "15px 18px", borderBottom: "1px solid #f1f5f9" }}>{p.constituency ?? "N/A"}</td>
                      <td style={{ padding: "15px 18px", borderBottom: "1px solid #f1f5f9" }}>{p.zone ?? "N/A"}</td>
                      <td style={{ padding: "15px 18px", borderBottom: "1px solid #f1f5f9" }}>{p.population ?? 0}</td>
                      <td style={{ padding: "15px 18px", borderBottom: "1px solid #f1f5f9" }}>{p.households ?? 0}</td>
                      <td style={{ padding: "15px 18px", borderBottom: "1px solid #f1f5f9" }}>{p.area ?? "N/A"}</td>
                      <td style={{ padding: "15px 18px", borderBottom: "1px solid #f1f5f9" }}>₹{(p.income ?? 0).toLocaleString()}</td>
                      <td style={{ padding: "15px 18px", borderBottom: "1px solid #f1f5f9" }}>{density}</td>
                      <td style={{ padding: "15px 18px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, backgroundColor: score >= 4 ? "#fee2e2" : score >= 2 ? "#fefce8" : "#f0fdf4", color: score >= 4 ? "#b91c1c" : score >= 2 ? "#854d0e" : "#166534" }}>{score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              margin: "24px 0",
              flexWrap: "wrap"
            }}>
              <button
                onClick={() => setCurrentPage((c) => Math.max(c - 1, 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "10px 15px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  backgroundColor: currentPage === 1 ? "#f3f4f6" : "#fff",
                  color: "#374151",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  fontWeight: 500
                }}
              >
                Previous
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  style={{
                    padding: "10px 15px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    backgroundColor: currentPage === i + 1 ? "#7C3AED" : "#fff",
                    color: currentPage === i + 1 ? "#fff" : "#374151",
                    cursor: "pointer",
                    fontWeight: 500,
                    minWidth: "44px"
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((c) => Math.min(c + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{
                  padding: "10px 15px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  backgroundColor: currentPage === totalPages ? "#f3f4f6" : "#fff",
                  color: "#374151",
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  fontWeight: 500
                }}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {city === "Delhi" && (
        <section style={{ padding: "40px 32px", backgroundColor: "#f8fafc" }}>
          <div style={{ marginTop: "40px" }}>
            <h2 style={{ margin: "0 0 32px 0", fontSize: "24px", fontWeight: 700, color: "#1e2937", textAlign: "center" }}>Analytics</h2>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "32px" }}>
              <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "16px", color: "#1e2937" }}>Slums by Constituency</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={constituencyData}>
                    <CartesianGrid strokeDasharray="2 2" />
                    <XAxis dataKey="name" angle={-40} textAnchor="end" height={75} tick={{ fontSize: 11.5 }} />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "16px", color: "#1e2937" }}>Slums by Zone</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={zoneData}>
                    <CartesianGrid strokeDasharray="2 2" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "16px", color: "#1e2937", textAlign: "center" }}>Pre vs Post 1995</div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={prePostData} cx="50%" cy="50%" innerRadius={48} outerRadius={82} dataKey="value" nameKey="name" label={({ name, value, percent }) => `${name} ${value} (${(percent * 100).toFixed(0)}%)`}>
                      {prePostData.map((_, i) => <Cell key={i} fill={["#7C3AED", "#ec4899", "#14b8a6"][i % 3]} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "16px", color: "#1e2937", textAlign: "center" }}>Land Use Distribution</div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={landuseData} cx="50%" cy="50%" outerRadius={82} dataKey="value" nameKey="name" label={({ name, value, percent }) => `${name} ${value} (${(percent * 100).toFixed(0)}%)`}>
                      {landuseData.map((_, i) => <Cell key={i} fill={["#7C3AED", "#22c55e", "#eab308", "#f43f5e", "#8b5cf6"][i % 5]} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
