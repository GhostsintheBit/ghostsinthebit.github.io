// Scenario loader. Reads /scenarios/registry.json and each scenario's
// own scenario.json for hints, indexes, sample queries.

const REGISTRY_URL = "/scenarios/registry.json";

export async function loadRegistry() {
  try {
    const res = await fetch(REGISTRY_URL);
    if (!res.ok) throw new Error(`Registry returned ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("Failed to load scenario registry:", e);
    return { scenarios: [] };
  }
}

export async function loadScenarioManifest(scenarioId) {
  try {
    const res = await fetch(`/scenarios/${scenarioId}/scenario.json`);
    if (!res.ok) throw new Error(`Manifest returned ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`Failed to load manifest for ${scenarioId}:`, e);
    return null;
  }
}

export function getScenarioIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("scenario");
}

export function setScenarioIdInUrl(scenarioId) {
  const url = new URL(window.location.href);
  if (scenarioId) {
    url.searchParams.set("scenario", scenarioId);
  } else {
    url.searchParams.delete("scenario");
  }
  window.history.replaceState({}, "", url.toString());
}
