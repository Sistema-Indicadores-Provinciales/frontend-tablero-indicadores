import { analytics } from "config/Analytics";

interface GeoJsonFeature {
  geometry: {
    type: "Polygon" | "MultiPolygon";
  };
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

let boundaryRequest: Promise<GeoJsonFeatureCollection> | null = null;

const isFeatureCollection = (value: unknown): value is GeoJsonFeatureCollection => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<GeoJsonFeatureCollection>;
  return candidate.type === "FeatureCollection" && Array.isArray(candidate.features) &&
    candidate.features.length > 0 && candidate.features.every(feature =>
      feature?.geometry?.type === "Polygon" || feature?.geometry?.type === "MultiPolygon"
    );
};

/** Consulta una vez por sesión el límite validado y almacenado por analytics. */
export const getFormosaBoundary = (): Promise<GeoJsonFeatureCollection> => {
  if (boundaryRequest) return boundaryRequest;

  boundaryRequest = analytics
    .get<unknown>("/v2/maps/formosa-boundary", {
      headers: { Accept: "application/geo+json, application/json" },
    })
    .then(response => {
      if (!isFeatureCollection(response.data)) {
        throw new Error("El servidor no devolvió un polígono provincial válido.");
      }

      return response.data;
    })
    .catch(error => {
      // Una falla transitoria no debe quedar almacenada para los siguientes mapas.
      boundaryRequest = null;
      throw error;
    });

  return boundaryRequest;
};
