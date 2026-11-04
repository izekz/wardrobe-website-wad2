import { reactive, watch } from "vue";
import { authState } from "./authService";
export const categories = [
  "Tops",
  "Bottoms",
  "Jackets",
  "Dresses",
  "Shoes",
  "Accessories",
];
export const colours = [
  "White",
  "Black",
  "Beige",
  "Cream",
  "Grey",
  "Brown",
  "Navy",
  "Blue",
  "Pink",
  "Purple",
  "Green",
  "Red",
  "Yellow",
  "Orange",
  "Multicolour",
];
export const styles = [
  "Minimalist",
  "Streetwear",
  "Vintage",
  "Y2K",
  "Preppy",
  "Classic",
  "Romantic"
];
export const occasions = [
  "University",
  "Presentation",
  "Interview",
  "Date",
  "Internship / work",
  "Casual outings",
  "Formal events"
];
// Display/filter existing saved occasions using the current group terminology.
export function normalizeOccasion(value) {
  return ({ Work: "Internship / work", "Casual outing": "Casual outings", "Formal dinner": "Formal events" })[value] || value;
}
export const weatherTags = ["Warm", "Rainy", "Cool"];
export const categoryName = (c) => (c === "Jackets" ? "Outerwear" : c);
export function today() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export async function wardrobeApi(path, options = {}) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch("/api/wardrobe" + path, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (response.status === 401 && (!options.headers?.['X-Planner-User'] || options.headers['X-Planner-User'] === String(authState.user?.id))) {
      authState.user = null;
      window.dispatchEvent(new Event("auth:expired"));
    }
    if (!response.ok)
      throw Object.assign(new Error(result?.message || "Unable to complete the request. Please try again."), { code: result?.code });
    if (!result) throw new Error("Unexpected server response.");
    return result;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("The request took too long. Please try again.");
    if (error instanceof TypeError)
      throw new Error("Cannot reach the backend. Check that it is running.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export const send = (method, body) => ({ method, body: JSON.stringify(body) });
export function readPhoto(file) {
  if (
    !file ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    return Promise.reject(
      new Error("Choose a JPG, PNG or WebP image up to 5 MB."),
    );
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(file);
  });
}

export function matchesSearch(values, query) {
  const text = values.flat(Infinity).filter(Boolean).join(" ").toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word));
}
export function weatherEmoji(weather) {
  if (!weather?.available) return "🌤️";
  const condition = weather.condition.toLowerCase();
  if (condition.includes("thunder")) return "⛈️";
  if (condition.includes("rain") || condition.includes("shower")) return "🌧️";
  if (condition.includes("partly")) return "⛅";
  if (condition.includes("cloud") || condition.includes("fog")) return "☁️";
  if (condition.includes("snow")) return "🌨️";
  return "☀️";
}

// Private account-owned products collected for planning, independent of cart and likes.
export const plannerProductsState = reactive({ ownerId: null, products: [], ready: false, loading: false, pending: 0, error: '' });
export const storeVariantKey = piece => `${piece.productId}:${piece.colour || ''}:${piece.size || ''}`;
let plannerGeneration = 0, plannerHydration = null, plannerQueue = Promise.resolve();
const plannerOwnerId = () => authState.user?.role === 'consumer' ? String(authState.user.id) : null;
const plannerContext = () => ({ owner: plannerProductsState.ownerId, generation: plannerGeneration });
const samePlannerAccount = ctx => ctx.owner && ctx.owner === plannerOwnerId() && ctx.owner === plannerProductsState.ownerId && ctx.generation === plannerGeneration;
const plannerChanged = () => Object.assign(new Error('Your signed-in account changed. Please try again.'), { code: 'ACCOUNT_CHANGED' });
watch(plannerOwnerId, owner => {
  plannerGeneration++;
  plannerHydration = null;
  plannerQueue = Promise.resolve();
  Object.assign(plannerProductsState, { ownerId: owner, products: [], ready: false, loading: false, pending: 0, error: '' });
}, { immediate: true, flush: 'sync' });
async function plannerRequest(path, options, ctx) {
  if (!samePlannerAccount(ctx)) throw plannerChanged();
  let result;
  try { result = await wardrobeApi('/planner-products' + path, { ...options, headers: { 'X-Planner-User': ctx.owner } }); }
  catch (error) {
    if (!samePlannerAccount(ctx)) throw plannerChanged();
    if (error.code === 'ACCOUNT_CHANGED') {
      authState.user = null;
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw error;
  }
  if (!samePlannerAccount(ctx)) throw plannerChanged();
  if (result.userId !== ctx.owner || !Array.isArray(result.products)) throw new Error('Unexpected planner response. Please refresh and try again.');
  plannerProductsState.products = result.products;
  plannerProductsState.ready = true;
  return result;
}
export function hydratePlannerProducts(force = false) {
  if (!plannerOwnerId()) return Promise.resolve();
  if (plannerHydration) return plannerHydration;
  if (plannerProductsState.pending) return plannerQueue.then(() => hydratePlannerProducts(force));
  if (plannerProductsState.ready && !force) return Promise.resolve();
  const ctx = plannerContext();
  plannerProductsState.loading = true;
  plannerProductsState.error = '';
  const task = plannerRequest('', {}, ctx).catch(error => {
    if (samePlannerAccount(ctx)) plannerProductsState.error = error.message;
    throw error;
  }).finally(() => {
    if (plannerHydration === task) plannerHydration = null;
    if (samePlannerAccount(ctx)) plannerProductsState.loading = false;
  });
  plannerHydration = task;
  return task;
}
function mutatePlanner(path, options) {
  const ctx = plannerContext();
  const task = plannerQueue.catch(() => {}).then(async () => {
    if (!samePlannerAccount(ctx)) throw plannerChanged();
    await hydratePlannerProducts();
    if (!samePlannerAccount(ctx)) throw plannerChanged();
    plannerProductsState.pending++;
    plannerProductsState.error = '';
    try { return await plannerRequest(path, options, ctx); }
    catch (error) { if (samePlannerAccount(ctx)) plannerProductsState.error = error.message; throw error; }
    finally { if (samePlannerAccount(ctx)) plannerProductsState.pending--; }
  });
  plannerQueue = task.catch(() => {});
  return task;
}
export function addPlannerProduct(product, { colour = '', size = '' } = {}) {
  return mutatePlanner('', send('POST', { productId: product.productId, colour, size }));
}
export function removePlannerProduct(key) { return mutatePlanner('/' + encodeURIComponent(key), { method: 'DELETE' }); }
