"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix standard Leaflet icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapExperienceProps {
  properties: any[];
  hoveredPropertyId: string | null;
  onMarkerHover: (id: string | null) => void;
}

// Component to dynamically adjust bounds when properties change
function BoundsTracker({ properties }: { properties: any[] }): null {
  const map = useMap();
  useEffect(() => {
    if (properties.length > 0) {
      const bounds = L.latLngBounds(properties.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [properties, map]);
  return null;
}

export function MapExperience({ properties, hoveredPropertyId, onMarkerHover }: MapExperienceProps) {
  // Default to center of Australia if no properties
  const center: [number, number] = properties.length > 0 ? [properties[0].lat, properties[0].lng] : [-25.2744, 133.7751];

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer center={center} zoom={13} className="w-full h-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsTracker properties={properties} />
        
        {properties.map((prop) => (
          <Marker 
            key={prop.id} 
            position={[prop.lat, prop.lng]}
            eventHandlers={{
              mouseover: () => onMarkerHover(prop.id),
              mouseout: () => onMarkerHover(null),
            }}
          >
            <Popup>
              <div className="font-bold text-sm">{prop.name}</div>
              <div className="text-xs text-slate-500">${prop.lowestPricePerWeek}/wk</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Dev Warning */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 py-1.5 rounded shadow-sm z-[1000] border border-slate-200">
        DEV MODE: OpenStreetMap Tiles
      </div>
    </div>
  );
}
