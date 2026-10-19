export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export const DEFAULT_CENTER: google.maps.LatLngLiteral = {
  lat: -26.1849,
  lng: -58.1731,
};

export const DEFAULT_ZOOM = 12;

// Punto medio de la extensión provincial publicada por el IGN.
export const FORMOSA_PROVINCE_CENTER: google.maps.LatLngLiteral = {
  lat: -24.666481,
  lng: -59.950844,
};

export const FORMOSA_PROVINCE_ZOOM = 7;

export const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  scrollwheel: true,
  streetViewControl: false,
};
