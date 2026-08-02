import worldCountries from "../data/world-countries.json";

/** Contorno de Perú (Natural Earth) para borde doble al encuadrar país en visitante 2.0 */
export function getPeruCountryFeatureCollection() {
  const peru = worldCountries.features.find((f) => {
    const p = f.properties || {};
    return p.ADMIN === "Peru" || p.ISO_A3 === "PER" || p.ADM0_A3 === "PER";
  });
  if (!peru) {
    return { type: "FeatureCollection", features: [] };
  }
  return {
    type: "FeatureCollection",
    features: [{ ...peru, properties: { ...peru.properties, slug: "peru" } }],
  };
}
