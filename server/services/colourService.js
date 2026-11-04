// Public palette data only: no account, item IDs, descriptions or photos leave the server.
const accentHex = Object.freeze({
  blue: "2967A8", pink: "F5C6D8", purple: "76528C", green: "2C704F",
  red: "AB3E50", yellow: "FFE58B", orange: "FFCF91",
});
const modes = ["complement", "analogic"];
function hsl(hex) {
  const channels = hex.match(/../g).map(value => parseInt(value, 16) / 255);
  const max = Math.max(...channels), min = Math.min(...channels), delta = max - min;
  if (!delta) return { hue: 0, saturation: 0 };
  const [r, g, b] = channels, lightness = (max + min) / 2;
  const angle = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { hue: ((angle * 60) % 360 + 360) % 360, saturation: delta / (1 - Math.abs(2 * lightness - 1)) };
}
function parsePalette(data, mode) {
  if (data?.mode !== mode || !Array.isArray(data.colors) || data.colors.length < 2 || data.colors.length > 12) throw new Error("Invalid palette");
  return data.colors.map(colour => {
    const value = colour?.hex?.clean || colour?.hex?.value;
    if (typeof value !== "string" || !/^#?[a-f\d]{6}$/i.test(value)) throw new Error("Invalid palette colour");
    return hsl(value.replace(/^#/, ""));
  });
}
function closeHue(a, b) {
  // Named wardrobe colours represent broad shades. Ignore lightness and allow a
  // 20-degree hue tolerance; reject near-grey swatches rather than treating them as accents.
  const distance = Math.abs(a.hue - b.hue);
  return a.saturation >= 0.15 && b.saturation >= 0.15 && Math.min(distance, 360 - distance) <= 20;
}
function createColourService({ fetcher = fetch, now = Date.now, timeoutMs = 1800, cacheMs = 24 * 60 * 60 * 1000, failureMs = 60 * 1000 } = {}) {
  // At most 7 fixed seeds × 2 modes. Share pending requests across users.
  const cache = new Map(), pending = new Map();
  async function palette(seed, mode) {
    const key = `${seed}:${mode}`, entry = cache.get(key);
    if (entry && entry.expires > now()) return entry.value;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const controller = new AbortController();
      let timer, value = null;
      try {
        const url = new URL("https://www.thecolorapi.com/scheme");
        url.search = new URLSearchParams({ hex: accentHex[seed], mode, count: "5" });
        value = await Promise.race([
          (async () => {
            const response = await fetcher(url, { signal: controller.signal, redirect: "error" });
            if (!response.ok) throw new Error("Palette unavailable");
            return parsePalette(await response.json(), mode);
          })(),
          new Promise((resolve, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error("Palette timed out")); }, timeoutMs);
          }),
        ]);
      } catch { /* Offline, throttled or malformed responses use the local scoring rules. */ }
      finally { clearTimeout(timer); }
      cache.set(key, { value, expires: now() + (value ? cacheMs : failureMs) });
      return value;
    })();
    pending.set(key, task);
    try { return await task; }
    finally { if (pending.get(key) === task) pending.delete(key); }
  }
  return async function getColourMatches(colours) {
    const accents = [...new Set(colours.map(value => String(value || "").trim().toLowerCase()).filter(value => Object.hasOwn(accentHex, value)))].sort();
    const pairs = accents.flatMap((seed, index) => accents.slice(index + 1).map(target => [seed, target]));
    if (!pairs.length) return {};
    // A canonical seed makes pair results independent of selection order.
    const seeds = [...new Set(pairs.map(([seed]) => seed))];
    const palettes = new Map(await Promise.all(seeds.map(async seed => [seed, await Promise.all(modes.map(mode => palette(seed, mode)))])));
    return Object.fromEntries(pairs.map(([seed, target]) => {
      const values = palettes.get(seed), colour = hsl(accentHex[target]);
      const matchedModes = modes.filter((mode, index) => values[index]?.some(swatch => closeHue(swatch, colour)));
      return [`${seed}:${target}`, { available: matchedModes.length > 0 || values.every(Boolean), matches: matchedModes.length > 0, modes: matchedModes }];
    }));
  };
}
const getColourMatches = createColourService();
module.exports = { createColourService, getColourMatches };
