import React, { useCallback, useEffect, useRef } from "react";
import {
  GoogleMap,
  MarkerF,
  CircleF,
  useJsApiLoader,
} from "@react-google-maps/api";

import {
  GOOGLE_MAPS_API_KEY,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_OPTIONS,
} from "../../config/googleMaps";

export interface MapMarker {
  id: string;
  position: google.maps.LatLngLiteral;

  title?: string;
  subtitle?: string;
  label?: string;
  icon?: string | google.maps.Icon | google.maps.Symbol;

  draggable?: boolean;
  visible?: boolean;
  zIndex?: number;

  data?: unknown;
}

export interface MapCircle {
  id: string;
  center: google.maps.LatLngLiteral;
  radius: number;
  options?: google.maps.CircleOptions;
}

export type MapDisplayMode = "markers" | "circles";

export interface MapsProps {
  center?: google.maps.LatLngLiteral;
  zoom?: number;
  options?: google.maps.MapOptions;

  width?: string;
  height?: string;

  displayMode?: MapDisplayMode;

  markers?: MapMarker[];
  circles?: MapCircle[];

  fitBounds?: boolean;

  onMapLoad?: (map: google.maps.Map) => void;
  onMapUnmount?: () => void;
  onMapClick?: (event: google.maps.MapMouseEvent) => void;

  onMarkerClick?: (marker: MapMarker) => void;
  onMarkerHover?: (marker: MapMarker) => void;
  onMarkerDragEnd?: (
    marker: MapMarker,
    event: google.maps.MapMouseEvent
  ) => void;
}

const Maps: React.FC<MapsProps> = ({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  options = MAP_OPTIONS,

  width = "100%",
  height = "100%",

  displayMode = "markers",

  markers = [],
  circles = [],

  fitBounds = false,

  onMapLoad,
  onMapUnmount,
  onMapClick,

  onMarkerClick,
  onMarkerHover,
  onMarkerDragEnd,
}) => {
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const handleLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      if (fitBounds && markers.length > 0) {
        if (markers.length === 1) {
            map.setCenter(markers[0].position);
            map.setZoom(16);
        } else {
            const bounds = new google.maps.LatLngBounds();

            markers.forEach(marker => bounds.extend(marker.position));

            map.fitBounds(bounds);
        }
    }
      onMapLoad?.(map);
    },
    [fitBounds, markers, onMapLoad]
  );

  const handleUnmount = useCallback(() => {
    mapRef.current = null;
    onMapUnmount?.();
  }, [onMapUnmount]);

  useEffect(() => {
    if (!fitBounds) return;
    if (!mapRef.current) return;
    if (!markers.length) return;

    const bounds = new window.google.maps.LatLngBounds();

    markers.forEach((marker) => bounds.extend(marker.position));

    mapRef.current.fitBounds(bounds);
  }, [markers, fitBounds]);

  if (loadError) {
    return <div>Error al cargar Google Maps.</div>;
  }

  if (!isLoaded) {
    return <div>Cargando mapa...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={{
        width,
        height,
      }}
      center={center}
      zoom={zoom}
      options={options}
      onLoad={handleLoad}
      onUnmount={handleUnmount}
      onClick={onMapClick}
    >
      {displayMode === "markers" &&
        markers.map((marker) => (
          <MarkerF
            key={marker.id}
            position={marker.position}
            title={marker.title}
            label={marker.label}
            icon={marker.icon}
            draggable={marker.draggable}
            visible={marker.visible}
            zIndex={marker.zIndex}
            onClick={() => onMarkerClick?.(marker)}
            onMouseOver={() => onMarkerHover?.(marker)}
            onDragEnd={(event) =>
              onMarkerDragEnd?.(marker, event)
            }
          />
        ))}

      {displayMode === "circles" &&
        circles.map((circle) => (
          <CircleF
            key={circle.id}
            center={circle.center}
            radius={circle.radius}
            options={circle.options}
          />
        ))}
    </GoogleMap>
  );
};

export default React.memo(Maps);
