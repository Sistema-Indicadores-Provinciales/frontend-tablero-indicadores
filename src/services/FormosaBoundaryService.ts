import { FORMOSA_BOUNDARY_URL } from "config/googleMaps";

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: object[];
}

let boundaryRequest: Promise<GeoJsonFeatureCollection> | null = null;

const isFeatureCollection = (value: unknown): value is GeoJsonFeatureCollection => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<GeoJsonFeatureCollection>;
  return candidate.type === "FeatureCollection" && Array.isArray(candidate.features);
};

/** Consulta una vez por sesión la geometría oficial de la provincia. */
export const getFormosaBoundary = (): Promise<GeoJsonFeatureCollection> => {
  if (boundaryRequest) return boundaryRequest;

  boundaryRequest = fetch(FORMOSA_BOUNDARY_URL, {
    headers: { Accept: "application/geo+json, application/json" },
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`GeoRef respondió con estado ${response.status}.`);
      }

      const data: unknown = await response.json();
      if (!isFeatureCollection(data) || data.features.length === 0) {
        throw new Error("GeoRef no devolvió el límite provincial esperado.");
      }

      return data;
    })
    .catch(error => {
      // Una falla transitoria no debe quedar almacenada para los siguientes mapas.
      boundaryRequest = null;
      throw error;
    });

  return boundaryRequest;
};
