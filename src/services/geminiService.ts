import { GoogleGenAI, Type } from "@google/genai";
import { AlertData, RegionData, Dialect, DialectTranslation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeRisk(region: RegionData): Promise<AlertData> {
  // Attempt to get real-time context if possible
  let realTimeContext = "";
  try {
    const weather = await fetchWeatherWithAI(region.name);
    realTimeContext = `
      REAL-TIME GROUND TRUTH (from Google Search):
      - Current Temp: ${weather.main.temp}°C
      - Humidity: ${weather.main.humidity}%
      - Wind Speed: ${(weather.wind.speed * 3.6).toFixed(1)} km/h
      - Rainfall: ${weather.rain?.['1h'] || 0} mm/h
      - Description: ${weather.weather[0].description}
    `;
  } catch (e) {
    console.warn("Could not fetch real-time context for risk analysis, using static data.");
  }

  const prompt = `
    You are the core intelligence engine for SafeSignal BD, a multi-hazard early warning system for Bangladesh.
    Analyze the following meteorological and hydrological data for ${region.name} (${region.name_bn}):
    
    - Region: ${region.name}
    - Primary Hazard Focus: ${region.primary_hazard}
    - Static Rainfall: ${region.current_rainfall}mm
    - Static Temperature: ${region.current_temp}°C
    ${region.water_level !== undefined ? `- Water Level (above danger): ${region.water_level}m` : ''}

    ${realTimeContext}

    Rules:
    1. Rainfall > 100mm in 24h triggers "High Risk" for landslides in Hilly areas (Chittagong/Sylhet).
    2. Use Random Forest/ARIMA style logic to categorize risks into Low, Medium, or High.
    3. Coastal areas prioritize Cyclone/Storm Surge.
    4. North prioritizes Drought.
    5. Northeast prioritizes Flash Flood.
    
    Generate a structured alert in both English and Bangla.
    Provide actionable steps and a technical summary.
    Include an SMS format (max 160 chars).
    Include a shelter recommendation if risk is High.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          risk_level: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
          hazard_type: { type: Type.STRING },
          location: { type: Type.STRING },
          alert_msg_en: { type: Type.STRING },
          alert_msg_bn: { type: Type.STRING },
          action_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          offline_relay_eligible: { type: Type.BOOLEAN },
          technical_summary: { type: Type.STRING },
          sms_format: { type: Type.STRING },
          shelter_recommendation: { type: Type.STRING }
        },
        required: ["risk_level", "hazard_type", "location", "alert_msg_en", "alert_msg_bn", "action_steps", "offline_relay_eligible"]
      }
    }
  });

  return JSON.parse(response.text || "{}") as AlertData;
}

export async function fetchWeatherWithAI(location: string): Promise<any> {
  const prompt = `
    Search for the current weather in ${location}, Bangladesh.
    Provide the following details in JSON format:
    - temperature (Celsius)
    - humidity (%)
    - windSpeed (km/h)
    - rainfall (mm/h)
    - description (short summary)
    - isMock (set to false since this is real-time search data)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            temperature: { type: Type.NUMBER },
            humidity: { type: Type.NUMBER },
            windSpeed: { type: Type.NUMBER },
            rainfall: { type: Type.NUMBER },
            description: { type: Type.STRING },
            isMock: { type: Type.BOOLEAN }
          },
          required: ["temperature", "humidity", "windSpeed", "rainfall", "description", "isMock"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    // Map to OpenWeather-like structure for compatibility
    return {
      main: {
        temp: data.temperature,
        humidity: data.humidity
      },
      wind: {
        speed: data.windSpeed / 3.6 // Convert km/h back to m/s for consistency with API
      },
      rain: {
        '1h': data.rainfall
      },
      weather: [{ description: data.description }],
      isAI: true
    };
  } catch (error) {
    console.error("AI Weather Fetch Error:", error);
    throw error;
  }
}

export async function translateToDialect(text: string, dialect: Dialect): Promise<DialectTranslation> {
  const prompt = `
    You are an expert linguist specializing in Bangladeshi dialects.
    Translate the following English alert message into the ${dialect} dialect of Bangladesh.
    
    Message: "${text}"
    
    Rules:
    1. Use authentic vocabulary and sentence structure specific to ${dialect}.
    2. Provide the translation in Bangla script.
    3. Provide a simplified phonetic pronunciation for those who might not read Bangla script well.
    4. Keep the tone urgent but empathetic.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dialect: { type: Type.STRING },
          translated_text: { type: Type.STRING },
          phonetic_pronunciation: { type: Type.STRING }
        },
        required: ["dialect", "translated_text", "phonetic_pronunciation"]
      }
    }
  });

  return JSON.parse(response.text || "{}") as DialectTranslation;
}
