export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Extreme';
export type HazardType = 'Flood' | 'Flash Flood' | 'Cyclone' | 'Landslide' | 'Drought' | 'Heatwave' | 'Storm Surge' | 'Earthquake';
export type AlertCategory = 'Early Warning' | 'Emergency Alert' | 'Evacuation Alert';
export type Language = 'English' | 'Bangla';
export type VulnerabilityIndicator = 'Elderly' | 'Disabled' | 'Children' | 'Pregnant' | 'None';

export type Dialect = 'Standard' | 'Chatgaiya' | 'Sylheti' | 'Noakhailla' | 'Dhakaiya' | 'Barishali';

export interface DialectTranslation {
  dialect: Dialect;
  translated_text: string;
  phonetic_pronunciation?: string;
}

export interface AlertData {
  id: string;
  risk_level: RiskLevel;
  hazard_type: HazardType;
  category: AlertCategory;
  location: string;
  description?: string;
  alert_msg_en: string;
  alert_msg_bn: string;
  action_steps: string[];
  offline_relay_eligible: boolean;
  technical_summary?: string;
  sms_format?: string;
  shelter_recommendation?: string;
  timestamp: string;
  is_active: boolean;
}

export interface Feedback {
  id?: string;
  alertId: string;
  accuracy: number; // 1-5
  usefulness: number; // 1-5
  comments?: string;
  timestamp: string;
  regionId: string;
  userId?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  phone?: string;
  displayName?: string;
  role: 'admin' | 'user';
  language: Language;
  vulnerability: VulnerabilityIndicator[];
  mobileRotationMode?: boolean;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  createdAt: string;
}

export interface BMBData {
  districtId: string;
  temperature: number;
  rainfall: number;
  humidity?: number;
  uploadedBy: string;
  timestamp: string;
}

export interface BWDBData {
  districtId: string;
  waterLevel: number;
  dangerLevel?: number;
  uploadedBy: string;
  timestamp: string;
}

export interface FFWCData {
  districtId: string;
  waterLevel: number;
  discharge: number;
  dangerLevel: number;
  forecast24h: number;
  forecast48h: number;
  forecast72h: number;
  uploadedBy: string;
  timestamp: string;
}

export interface DAEData {
  districtId: string;
  cropType: string;
  soilMoisture: number;
  damageArea?: number; // in hectares
  advice_en: string;
  advice_bn: string;
  uploadedBy: string;
  timestamp: string;
}

export interface CPPData {
  districtId: string;
  signalLevel: number; // 1-10
  volunteersActive: number;
  evacuationProgress: number; // 0-100
  lastUpdate: string;
  uploadedBy: string;
  timestamp: string;
}

export interface RegionData {
  id: string;
  name: string;
  name_bn: string;
  primary_hazard: HazardType;
  current_rainfall: number; // mm
  current_temp: number; // Celsius
  current_wind_speed?: number; // km/h
  current_humidity?: number; // %
  water_level?: number; // meters above danger level
  image_url: string;
  specialty: string;
  lat: number;
  lng: number;
  risk_level?: RiskLevel;
  lastUpdated?: string;
}

export interface Shelter {
  id: string;
  name: string;
  regionId?: string;
  address?: string;
  capacity: number;
  current_occupancy: number;
  lat: number;
  lng: number;
  type: 'Cyclone' | 'Flood' | 'Multi-purpose';
}

export interface EmergencyContact {
  id: string;
  name: string;
  number: string;
  description?: string;
  type: 'Police' | 'Fire' | 'Ambulance' | 'Volunteer' | 'Local Authority';
}

export interface SOSAlert {
  id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  status: 'Pending' | 'Responding' | 'Resolved';
  timestamp: string;
  vulnerabilities: VulnerabilityIndicator[];
}

export interface Volunteer {
  id: string;
  name: string;
  phone: string;
  regionId: string;
  specialty: string[];
  isAvailable: boolean;
  rating: number;
  lastActive: string;
}

export interface MeshNode {
  id: string;
  name: string;
  distance: number; // in meters
  signalStrength: number; // 0-100
  lastSeen: string;
  isRelay: boolean;
  batteryLevel: number;
}

export interface ForecastDay {
  day: string;
  icon: 'rain' | 'storm' | 'sun-rain' | 'cloud-sun' | 'sun';
  rainfall: number;
  risk: RiskLevel;
}
