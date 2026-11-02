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
      },
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (response.status === 401) {
      authState.user = null;
      window.dispatchEvent(new Event("auth:expired"));
    }
    if (!response.ok)
      throw new Error(
        result?.message || "Unable to complete the request. Please try again.",
      );
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
