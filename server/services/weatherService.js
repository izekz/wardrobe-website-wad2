const { singaporeToday } = require("../communityValidation");
let cached;
function description(code) {
  if (code === 0) return "Clear skies";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code >= 95) return "Thunderstorms";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  return "Rain / showers";
}
async function getWeather(date, fetcher = fetch) {
  const unavailable = (message) => ({
    available: false,
    date,
    location: "Singapore",
    message,
    tags: [],
  });
  if (
    Math.round(
      (Date.parse(date + "T00:00:00Z") -
        Date.parse(singaporeToday() + "T00:00:00Z")) /
        86400000,
    ) > 15
  )
    return unavailable(
      "Forecasts are available up to 15 days ahead. Matching uses occasion and style for this date.",
    );
  try {
    if (
      !cached ||
      Date.now() - cached.at > 10 * 60 * 1000 ||
      fetcher !== fetch
    ) {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: "1.3521",
        longitude: "103.8198",
        daily: "temperature_2m_max,weather_code,precipitation_probability_max",
        timezone: "Asia/Singapore",
        forecast_days: "16",
      });
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Unavailable");
      const data = await response.json();
      if (!Array.isArray(data.daily?.time)) throw new Error("Invalid forecast");
      cached = { at: Date.now(), daily: data.daily };
    }
    const d = cached.daily,
      i = d.time.indexOf(date);
    if (
      i < 0 ||
      typeof d.temperature_2m_max?.[i] !== "number" ||
      typeof d.weather_code?.[i] !== "number"
    )
      throw new Error("Missing forecast");
    const temperature = d.temperature_2m_max[i],
      code = d.weather_code[i],
      rainChance = d.precipitation_probability_max?.[i] ?? null;
    const rainy =
      (code >= 51 && code <= 67) ||
      (code >= 80 && code <= 82) ||
      code >= 95 ||
      rainChance >= 50;
    return {
      available: true,
      date,
      location: "Singapore",
      temperature,
      condition: description(code),
      rainChance,
      tags: [temperature >= 27 ? "Warm" : "Cool", ...(rainy ? ["Rainy"] : [])],
      source: "Open-Meteo",
      advice: [
        temperature >= 27
          ? "Choose breathable fabrics and light layers."
          : "A comfortable layer may help.",
        ...(rainy
          ? ["Bring an umbrella and choose rain-suitable footwear."]
          : []),
      ],
    };
  } catch {
    return unavailable(
      "Weather is unavailable right now. Matching uses occasion and style; try again shortly.",
    );
  }
}
module.exports = { getWeather };
