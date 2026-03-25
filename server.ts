import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import twilio from "twilio";
import dotenv from "dotenv";
import admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}
const db = admin.firestore();
// Only set databaseId if it's not (default)
if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)") {
  try {
    db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
  } catch (e) {
    console.warn("Failed to set databaseId, falling back to default:", e);
  }
}

async function analyzeRiskWithAI(weatherData: any, city: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY missing. Skipping AI analysis.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
    const model = "gemini-3-flash-preview";
    const prompt = `
      Analyze the following weather data for ${city}, Bangladesh and determine the disaster risk level (Low, Medium, High).
      Weather Data: ${JSON.stringify(weatherData)}
      
      If the risk is Medium or High, identify the hazard type (e.g., Cyclone, Flood, Heatwave, Storm Surge).
      Provide a brief emergency description in English and a warning message in Bengali.
      
      Return the result in JSON format:
      {
        "riskLevel": "Low" | "Medium" | "High",
        "hazardType": "None" | string,
        "category": "Early Warning" | "Emergency Alert" | "Evacuation Alert",
        "description": string,
        "warningBengali": string
      }
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Helper to map city names for OpenWeatherMap compatibility
  const mapCityName = (city: string) => {
    const mapping: Record<string, string> = {
      "Cumilla": "Comilla",
      "Jashore": "Jessore",
      "Bogura": "Bogra",
      "Barishal": "Barisal",
      "Chattogram": "Chittagong"
    };
    return mapping[city] || city;
  };

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Weather API Proxy
  app.get("/api/weather", async (req, res) => {
    const { lat, lon, city } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    // Fallback data structure
    const getFallbackData = (cityName: string) => ({
      name: cityName || "Unknown",
      main: { temp: 25, humidity: 60, pressure: 1013 },
      wind: { speed: 10 },
      weather: [{ description: "stale data (API offline)", icon: "01d" }],
      offline: true
    });

    if (!apiKey) {
      console.warn("Weather API key not configured. Returning fallback data.");
      return res.json(getFallbackData(city as string || "Bangladesh"));
    }

    try {
      let url = `https://api.openweathermap.org/data/2.5/weather?appid=${apiKey}&units=metric`;
      if (lat && lon) {
        url += `&lat=${lat}&lon=${lon}`;
      } else if (city) {
        const owmCity = mapCityName(city as string);
        url += `&q=${owmCity},BD`;
      } else {
        return res.status(400).json({ error: "Missing location parameters" });
      }

      const response = await axios.get(url);
      res.json(response.data);
    } catch (error: any) {
      console.error("Weather API Error:", error.response?.data || error.message);
      // Return 200 with fallback data instead of error status to keep app functional
      res.json(getFallbackData(city as string || "Bangladesh"));
    }
  });

  // SMS API (Twilio)
  app.post("/api/sms/send", async (req, res) => {
    const { to, message } = req.body;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !from) {
      console.warn("Twilio credentials missing. Logging SMS to Firestore instead.");
      try {
        await db.collection("dissemination_logs").add({
          type: 'sms',
          to,
          message,
          status: 'fallback_logged',
          timestamp: new Date().toISOString(),
          reason: 'Twilio credentials missing'
        });
        return res.json({ success: true, fallback: true, message: "Logged to Firestore (Twilio Offline)" });
      } catch (e) {
        return res.status(500).json({ error: "Failed to log fallback SMS" });
      }
    }

    const client = twilio(accountSid, authToken);

    try {
      const result = await client.messages.create({
        body: message,
        from: from,
        to: to,
      });
      res.json({ success: true, sid: result.sid });
    } catch (error: any) {
      console.error("Twilio SMS Error:", error.message);
      res.status(500).json({ error: "Failed to send SMS", details: error.message });
    }
  });

  // Voice Call API (Twilio)
  app.post("/api/voice/call", async (req, res) => {
    const { to, message } = req.body;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !from) {
      console.warn("Twilio credentials missing. Logging Voice Call to Firestore instead.");
      try {
        await db.collection("dissemination_logs").add({
          type: 'voice',
          to,
          message,
          status: 'fallback_logged',
          timestamp: new Date().toISOString(),
          reason: 'Twilio credentials missing'
        });
        return res.json({ success: true, fallback: true, message: "Logged to Firestore (Twilio Offline)" });
      } catch (e) {
        return res.status(500).json({ error: "Failed to log fallback Voice Call" });
      }
    }

    const client = twilio(accountSid, authToken);

    try {
      const result = await client.calls.create({
        twiml: `<Response><Say voice="alice">${message}</Say></Response>`,
        from: from,
        to: to,
      });
      res.json({ success: true, sid: result.sid });
    } catch (error: any) {
      console.error("Twilio Voice Error:", error.message);
      res.status(500).json({ error: "Failed to initiate voice call", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Background Data Fetching: Poll all 64 districts in Bangladesh every 1 minute
  const BANGLADESH_CITIES = [
    // Dhaka Division
    "Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Jamalpur", "Kishoreganj", "Madaripur", "Manikganj", "Munshiganj", "Mymensingh", "Narayanganj", "Narsingdi", "Netrokona", "Rajbari", "Shariatpur", "Sherpur", "Tangail",
    // Chattogram Division
    "Chittagong", "Bandarban", "Brahmanbaria", "Chandpur", "Comilla", "Cox's Bazar", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati",
    // Khulna Division
    "Khulna", "Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira",
    // Rajshahi Division
    "Rajshahi", "Bogra", "Chapainawabganj", "Joypurhat", "Naogaon", "Natore", "Pabna", "Sirajganj",
    // Barisal Division
    "Barisal", "Barguna", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur",
    // Rangpur Division
    "Rangpur", "Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Thakurgaon",
    // Sylhet Division
    "Sylhet", "Habiganj", "Moulvibazar", "Sunamganj"
  ];
  
  const updateAllWeatherData = async () => {
    console.log("Background check: Fetching latest hazard data for all 64 districts...");
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      console.warn("OPENWEATHER_API_KEY missing. Weather sync skipped.");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const city of BANGLADESH_CITIES) {
      let retries = 3;
      let success = false;
      let data: any = null;

      const owmCity = mapCityName(city);

      while (retries > 0 && !success) {
        try {
          // Use city name with country code for better accuracy
          const url = `https://api.openweathermap.org/data/2.5/weather?q=${owmCity},BD&appid=${apiKey}&units=metric`;
          const response = await axios.get(url, { timeout: 10000 });
          data = response.data;
          success = true;
        } catch (error: any) {
          retries--;
          if (retries === 0) {
            console.error(`[OWM ERROR] ${city} (mapped: ${owmCity}):`, error.response?.status === 404 ? "City Not Found" : error.message);
          }
          if (retries > 0) await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!success || !data || !data.main || !data.wind) {
        failCount++;
        continue;
      }

      try {
        // Correctly parse rainfall data (OpenWeatherMap returns rain in 1h or 3h blocks)
        const rain1h = data.rain ? (data.rain["1h"] || 0) : 0;
        const temp = data.main.temp;
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed * 3.6; // Convert m/s to km/h
        const pressure = data.main.pressure;
        const weatherDesc = data.weather && data.weather[0] ? data.weather[0].description : "clear sky";

        // AI-Powered Risk Assessment
        const aiResult = await analyzeRiskWithAI(data, city);
        
        let riskLevel: "Low" | "Medium" | "High" = "Low";
        let hazardType = "None";
        let category: "Early Warning" | "Emergency Alert" | "Evacuation Alert" = "Early Warning";
        let alertTitle = "";
        let alertDesc = "";
        let alertBengali = "";

        if (aiResult && aiResult.riskLevel && aiResult.riskLevel !== "Low") {
          riskLevel = aiResult.riskLevel;
          hazardType = aiResult.hazardType || "Weather Hazard";
          category = aiResult.category || "Early Warning";
          alertTitle = `${hazardType} Detected in ${city}`;
          alertDesc = aiResult.description || `High risk weather detected in ${city}.`;
          alertBengali = aiResult.warningBengali || `${city} এলাকায় দুর্যোগের ঝুঁকি রয়েছে।`;
        } else {
          // Fallback to rule-based if AI fails or returns Low
          if (rain1h > 30 || windSpeed > 80) {
            riskLevel = "High";
            hazardType = windSpeed > 80 ? "Cyclone" : "Flash Flood";
            category = "Evacuation Alert";
          } else if (rain1h > 10 || windSpeed > 40 || temp > 40) {
            riskLevel = "Medium";
            hazardType = temp > 40 ? "Heatwave" : (windSpeed > 40 ? "Storm Surge" : "Flood");
            category = "Emergency Alert";
          }
          
          if (riskLevel !== "Low") {
            alertTitle = `${hazardType} Detected in ${city}`;
            alertDesc = `Automatic detection of ${hazardType.toLowerCase()} risk based on real-time meteorological data. Rain: ${rain1h}mm/h, Wind: ${windSpeed.toFixed(1)}km/h, Temp: ${temp}°C.`;
            alertBengali = `স্বয়ংক্রিয় সতর্কতা: ${city} এলাকায় ${hazardType} ঝুঁকি শনাক্ত করা হয়েছে।`;
          }
        }

        // Update region data with real-time weather
        const regionId = city.toLowerCase().replace(/\s+/g, '-');
        
        await db.collection("regions").doc(regionId).set({
          name: city,
          risk_level: riskLevel,
          current_rainfall: rain1h,
          current_temp: temp,
          current_humidity: humidity,
          current_wind_speed: windSpeed,
          pressure: pressure,
          weather_description: weatherDesc,
          lastUpdated: new Date().toISOString()
        }, { merge: true });

        successCount++;

        if (riskLevel !== "Low") {
          console.log(`[ALERT] ${riskLevel} Risk detected in ${city}: ${hazardType}`);
          
          // Create alert in Firestore
          const alertId = `auto_${city.toLowerCase()}_${Date.now()}`;
          await db.collection("alerts").doc(alertId).set({
            alert_msg_en: alertTitle,
            alert_msg_bn: alertBengali,
            description: alertDesc,
            category: category,
            risk_level: riskLevel,
            hazard_type: hazardType,
            location: city,
            timestamp: new Date().toISOString(),
            is_active: true,
            isAutoGenerated: true,
            active: true
          });

          // Multi-channel dissemination for High/Medium risk
          if (riskLevel === "High" || riskLevel === "Medium") {
            const usersSnapshot = await db.collection("users").where("phone", "!=", null).get();
            
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const from = process.env.TWILIO_PHONE_NUMBER;
            const twilioClient = (accountSid && authToken && from) ? twilio(accountSid, authToken) : null;

            for (const userDoc of usersSnapshot.docs) {
              const userData = userDoc.data();
              const phone = userData.phone;

              if (phone) {
                try {
                  if (twilioClient && from) {
                    await twilioClient.messages.create({
                      body: `[SafeSignal BD] ${category}: ${alertTitle}. Please take necessary precautions.`,
                      from: from,
                      to: phone,
                    });
                    if (riskLevel === "High") {
                      await twilioClient.calls.create({
                        twiml: `<Response><Say voice="alice">Attention. This is an emergency alert from Safe Signal Bangladesh. A ${hazardType} has been detected in ${city}. This is an ${category}. Please evacuate to the nearest shelter immediately.</Say></Response>`,
                        from: from,
                        to: phone,
                      });
                    }
                  } else {
                    await db.collection("dissemination_logs").add({
                      alertId,
                      userId: userDoc.id,
                      phone,
                      type: 'sms_fallback',
                      message: `[SafeSignal BD] ${category}: ${alertTitle}`,
                      status: 'logged_only',
                      timestamp: new Date().toISOString(),
                      reason: 'Twilio credentials missing'
                    });
                  }
                } catch (err: any) {
                  console.error(`Failed to disseminate to ${phone}:`, err.message);
                }
              }
            }
          }
        }
        
        // Sleep briefly to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`[FIRESTORE ERROR] ${city}:`, error.message);
        failCount++;
      }
    }
    console.log(`Weather sync complete. Success: ${successCount}, Failed: ${failCount}`);
  };

  // Initial update
  updateAllWeatherData();
  
  // Poll every 1 minute
  setInterval(updateAllWeatherData, 1 * 60 * 1000);

  // Admin endpoint to trigger manual update
  app.post("/api/admin/sync-weather", async (req, res) => {
    updateAllWeatherData();
    res.json({ message: "Weather sync initiated for all 64 districts." });
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
