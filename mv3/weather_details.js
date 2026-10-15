const weatherApi = globalThis.browser || globalThis.chrome;
const chinese = navigator.language.toLowerCase().startsWith('zh');
const conditionNames = {
  0: ['Clear sky', '晴'], 1: ['Mainly clear', '大致晴朗'], 2: ['Partly cloudy', '局部多云'], 3: ['Cloudy', '多云'],
  45: ['Fog', '雾'], 48: ['Fog', '雾'], 51: ['Drizzle', '毛毛雨'], 53: ['Drizzle', '毛毛雨'], 55: ['Drizzle', '毛毛雨'],
  56: ['Freezing drizzle', '冻雨'], 57: ['Freezing drizzle', '冻雨'], 61: ['Rain', '雨'], 63: ['Rain', '雨'], 65: ['Heavy rain', '大雨'],
  66: ['Freezing rain', '冻雨'], 67: ['Freezing rain', '冻雨'], 71: ['Snow', '雪'], 73: ['Snow', '雪'], 75: ['Heavy snow', '大雪'],
  77: ['Snow grains', '雪粒'], 80: ['Rain showers', '阵雨'], 81: ['Rain showers', '阵雨'], 82: ['Heavy rain showers', '强阵雨'],
  85: ['Snow showers', '阵雪'], 86: ['Snow showers', '阵雪'], 95: ['Thunderstorm', '雷暴'], 96: ['Thunderstorm', '雷暴'], 99: ['Thunderstorm', '雷暴']
};
const condition = code => conditionNames[code]?.[chinese ? 1 : 0] || (chinese ? '天气' : 'Weather');

async function loadWeather() {
  const result = await weatherApi.runtime.sendMessage({target: 'worker', type: 'get'});
  if (!result?.ok) throw Error(result?.error || 'Unable to load weather settings');
  const location = result.data.settings.weather;
  if (!location) throw Error(chinese ? '请先在设置中选择天气地点。' : 'Choose a weather location in Settings.');
  const fahrenheit = location.unit === 'fahrenheit';
  const temperature = value => `${Math.round(fahrenheit ? value * 9 / 5 + 32 : value)}°${fahrenheit ? 'F' : 'C'}`;
  document.title = `${location.name} - Cool Clock`;
  document.getElementById('city').textContent = location.name;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Weather request failed (${response.status})`);
  const data = await response.json();
  const humidity = data.current?.relative_humidity_2m;
  const humidityText = typeof humidity === 'number' && Number.isFinite(humidity) ?
    ` · ${chinese ? '湿度' : 'Humidity'} ${Math.round(humidity)}%` : '';
  document.getElementById('current').textContent =
    `${chinese ? '现在' : 'Now'}: ${temperature(data.current.temperature_2m)} · ${condition(data.current.weather_code)}${humidityText}`;
  const cards = data.daily.time.map((date, index) => {
    const card = document.createElement('div');
    card.className = 'day';
    const heading = document.createElement('strong');
    heading.textContent = new Date(date + 'T12:00:00').toLocaleDateString(navigator.language, {weekday: 'short', month: 'short', day: 'numeric'});
    const label = document.createElement('span');
    label.textContent = condition(data.daily.weather_code[index]);
    const range = document.createElement('span');
    range.textContent = `${temperature(data.daily.temperature_2m_min[index])}–${temperature(data.daily.temperature_2m_max[index])}`;
    card.append(heading, label, range);
    return card;
  });
  document.getElementById('forecast').replaceChildren(...cards);
}
loadWeather().catch(error => { document.getElementById('status').textContent = error.message; });
