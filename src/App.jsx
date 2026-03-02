import MapComponent from "./components/MapContainer";
import "./index.css";

function App() {
  return (
    <div className="app-container">
      <h2 className="title">Slum Impact Dashboard</h2>
      <MapComponent />
    </div>
  );
}

export default App;