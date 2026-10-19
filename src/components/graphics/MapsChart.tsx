import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import {
  GoogleMap,
  MarkerF,
  CircleF,
  InfoWindowF,
  useJsApiLoader,
} from "@react-google-maps/api";

import {
  GOOGLE_MAPS_API_KEY,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  FORMOSA_PROVINCE_CENTER,
  FORMOSA_PROVINCE_ZOOM,
  MAP_OPTIONS,
} from "../../config/googleMaps";
import { getFormosaBoundary } from "../../services/FormosaBoundaryService";

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
  infoContent?: React.ReactNode;
}

export interface MapCircle {
  id: string;
  center: google.maps.LatLngLiteral;
  radius: number;
  options?: google.maps.CircleOptions;
  data?: unknown;
  infoContent?: React.ReactNode;
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
  highlightFormosa?: boolean;

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

const EARTH_RADIUS_METERS = 6_378_137;

/** Extiende los límites para incluir el área completa de un círculo. */
const extendBoundsWithCircle = (bounds: google.maps.LatLngBounds, circle: MapCircle) => {
  const latitudeOffset = (circle.radius / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const latitudeRadians = circle.center.lat * (Math.PI / 180);
  const longitudeOffset = latitudeOffset / Math.max(Math.cos(latitudeRadians), 0.00001);

  bounds.extend({
    lat: circle.center.lat - latitudeOffset,
    lng: circle.center.lng - longitudeOffset,
  });
  bounds.extend({
    lat: circle.center.lat + latitudeOffset,
    lng: circle.center.lng + longitudeOffset,
  });
};

const fitMapToData = (
  map: google.maps.Map,
  displayMode: MapDisplayMode,
  markers: MapMarker[],
  circles: MapCircle[]
) => {
  const bounds = new google.maps.LatLngBounds();

  if (displayMode === "circles" && circles.length > 0) {
    circles.forEach(circle => extendBoundsWithCircle(bounds, circle));
  } else {
    const visibleMarkers = markers.filter(marker => marker.visible !== false);
    if (visibleMarkers.length === 1) {
      map.setCenter(visibleMarkers[0].position);
      map.setZoom(16);
      return;
    }
    visibleMarkers.forEach(marker => bounds.extend(marker.position));
  }

  if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
};

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
  highlightFormosa = false,

  onMapLoad,
  onMapUnmount,
  onMapClick,

  onMarkerClick,
  onMarkerHover,
  onMarkerDragEnd,
}) => {
  const theme = useTheme();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<{ key: string; position: google.maps.LatLngLiteral; content: React.ReactNode } | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{ key: string; position: google.maps.LatLngLiteral; content: React.ReactNode } | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const visibleInfo = selectedInfo || hoveredInfo;
  const mapCenter = highlightFormosa ? FORMOSA_PROVINCE_CENTER : center;
  const mapZoom = highlightFormosa ? FORMOSA_PROVINCE_ZOOM : zoom;
  const isDarkMode = theme.palette.mode === "dark";
  const mapColorScheme = isDarkMode ? "DARK" : "LIGHT";
  const themedOptions = useMemo(() => ({
    ...options,
    colorScheme: mapColorScheme,
  }), [mapColorScheme, options]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const handleLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      if (highlightFormosa) {
        setBoundaryError(null);
        void getFormosaBoundary()
          .then(boundary => {
            if (mapRef.current !== map) return;

            map.data.addGeoJson(boundary);
            map.data.setStyle({
              clickable: false,
              fillColor: isDarkMode ? "#14b8a6" : "#38bdf8",
              fillOpacity: isDarkMode ? 0.38 : 0.34,
              strokeColor: isDarkMode ? "#5eead4" : "#0369a1",
              strokeOpacity: 1,
              strokeWeight: 3,
            });
          })
          .catch(error => {
            if (mapRef.current !== map) return;
            console.error("No se pudo cargar el límite de Formosa desde el IGN.", error);
            setBoundaryError("No se pudo cargar el contorno oficial de Formosa.");
          });
      } else if (fitBounds && markers.length > 0) {
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
    [fitBounds, highlightFormosa, isDarkMode, markers, onMapLoad]
  );

  const handleUnmount = useCallback(() => {
    mapRef.current = null;
    onMapUnmount?.();
  }, [onMapUnmount]);

  useEffect(() => {
    if (!fitBounds) return;
    if (!mapRef.current) return;

    fitMapToData(mapRef.current, displayMode, markers, circles);
  }, [circles, displayMode, fitBounds, markers]);

  if (loadError) {
    return <div>Error al cargar Google Maps.</div>;
  }

  if (!isLoaded) {
    return <div>Cargando mapa...</div>;
  }

  return (
    <>
      {boundaryError && <div role="alert">{boundaryError}</div>}
      {/* Google Maps solo aplica colorScheme durante la creación del mapa. */}
      <GoogleMap
        key={mapColorScheme}
        mapContainerStyle={{
          width,
          height,
        }}
        center={mapCenter}
        zoom={mapZoom}
        options={themedOptions}
        onLoad={handleLoad}
        onUnmount={handleUnmount}
        onClick={event => { setSelectedInfo(null); setHoveredInfo(null); onMapClick?.(event); }}
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
              onClick={() => {
                if (marker.infoContent) setSelectedInfo({ key: `marker:${marker.id}`, position: marker.position, content: marker.infoContent });
                onMarkerClick?.(marker);
              }}
              onMouseOver={() => {
                if (marker.infoContent) setHoveredInfo({ key: `marker:${marker.id}`, position: marker.position, content: marker.infoContent });
                onMarkerHover?.(marker);
              }}
              onMouseOut={() => setHoveredInfo(current => current?.key === `marker:${marker.id}` ? null : current)}
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
              onClick={() => {
                if (circle.infoContent) setSelectedInfo({ key: `circle:${circle.id}`, position: circle.center, content: circle.infoContent });
              }}
              onMouseOver={() => {
                if (circle.infoContent) setHoveredInfo({ key: `circle:${circle.id}`, position: circle.center, content: circle.infoContent });
              }}
              onMouseOut={() => setHoveredInfo(current => current?.key === `circle:${circle.id}` ? null : current)}
            />
          ))}
        {visibleInfo && <InfoWindowF position={visibleInfo.position} onCloseClick={() => { setSelectedInfo(null); setHoveredInfo(null); }}>
          <>{visibleInfo.content}</>
        </InfoWindowF>}
      </GoogleMap>
    </>
  );
};

export default React.memo(Maps);
