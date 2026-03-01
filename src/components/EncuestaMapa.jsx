import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MONTE_HERMOSO_CENTER = [-38.9844, -61.2947];

function UpdateCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 16);
  }, [map, center]);
  return null;
}

export default function EncuestaMapa({ domicilio, lat, lng, onLocationChange, height = 200 }) {
  const [center, setCenter] = useState(lat != null && lng != null ? [lat, lng] : MONTE_HERMOSO_CENTER);
  const [markerPos, setMarkerPos] = useState(
    lat != null && lng != null ? [lat, lng] : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!domicilio?.trim()) {
      if (lat != null && lng != null) {
        setCenter([lat, lng]);
        setMarkerPos([lat, lng]);
      } else {
        setCenter(MONTE_HERMOSO_CENTER);
        setMarkerPos(MONTE_HERMOSO_CENTER);
      }
      return;
    }
    if (lat != null && lng != null) {
      setCenter([lat, lng]);
      setMarkerPos([lat, lng]);
      return;
    }
    setLoading(true);
    setError(null);
    const query = encodeURIComponent(`${domicilio}, Monte Hermoso, Buenos Aires, Argentina`);
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'es' },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.[0]) {
          const latitude = parseFloat(data[0].lat);
          const longitude = parseFloat(data[0].lon);
          setCenter([latitude, longitude]);
          setMarkerPos([latitude, longitude]);
          onLocationChange?.({ lat: latitude, lng: longitude });
        } else {
          setCenter(MONTE_HERMOSO_CENTER);
          setMarkerPos(MONTE_HERMOSO_CENTER);
        }
      })
      .catch((err) => {
        setError(err?.message || 'Error al geocodificar');
        setCenter(MONTE_HERMOSO_CENTER);
        setMarkerPos(MONTE_HERMOSO_CENTER);
      })
      .finally(() => setLoading(false));
  }, [domicilio]);

  const pos = markerPos || (lat != null && lng != null ? [lat, lng] : MONTE_HERMOSO_CENTER);

  return (
    <div className="encuesta-mapa-wrap" style={{ height, minHeight: 150, position: 'relative' }}>
      {loading && (
        <div className="encuesta-mapa-loading">
          <span>Cargando ubicación...</span>
        </div>
      )}
      {error && (
        <div className="encuesta-mapa-error" style={{ fontSize: '0.8125rem', color: '#dc2626', marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
      >
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <UpdateCenter center={center} />
        <Marker
          position={pos}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat: newLat, lng: newLng } = e.target.getLatLng();
              setCenter([newLat, newLng]);
              setMarkerPos([newLat, newLng]);
              onLocationChange?.({ lat: newLat, lng: newLng });
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
